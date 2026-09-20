//! Deterministic, bounded visual-ingredient analysis for the robby observation deck.
//!
//! This is deliberately an analysis record, not another reverse-art module. It
//! gives the viewer a compact account of how one source image was measured.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{CompileResult, CompilerError};
use crate::intake::inspect_image;
use crate::render::{
    nearest_palette_index, palette_for_pixels, palette_index_map, source_pixels, PaletteEntry,
};

pub const ANALYSIS_GRID_SIZE: usize = 8;
const MAX_ANALYSIS_PIXELS: usize = 262_144;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IngredientAnalysis {
    pub schema_version: String,
    pub source: SourceIngredients,
    pub evidence: EvidenceIngredients,
    pub palette: PaletteIngredients,
    pub structure: StructureIngredients,
    pub identity: IdentityIngredients,
    pub terrain: Option<TerrainIngredients>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SourceIngredients {
    pub byte_sha256: String,
    pub pixel_sha256: String,
    pub byte_size: u64,
    pub width: u32,
    pub height: u32,
    pub aspect_ratio: f64,
    pub orientation: Option<u16>,
    pub colour_profile: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceIngredients {
    pub exif: String,
    pub iptc: String,
    pub xmp: String,
    pub gps: String,
    pub c2pa: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaletteIngredients {
    pub requested_k: u8,
    pub method: String,
    pub ordering: String,
    pub entries: Vec<PaletteIngredientEntry>,
    pub index_map_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaletteIngredientEntry {
    pub hex: String,
    pub rgb: [u8; 3],
    pub pixels: u64,
    pub share_percent: f64,
    pub rank: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StructureIngredients {
    pub grid_size: usize,
    pub luminance_bands: Vec<u32>,
    pub spatial_cells: Vec<SpatialCell>,
    pub edge_field: Vec<u8>,
    pub texture_field: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SpatialCell {
    pub dominant_palette_rank: usize,
    pub palette_mix: Vec<u8>,
    pub mean_luminance: u8,
    pub texture: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IdentityIngredients {
    pub perceptual_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TerrainIngredients {
    pub representation: String,
    pub grid_size: usize,
    pub heights: Vec<u8>,
}

/// Analyse the source bytes without producing or persisting an image derivative.
/// The output is intentionally bounded to 8×8 fields so the browser can inspect
/// it immediately without moving a full raster through the UI.
pub fn analyze_image_json(bytes: &[u8], requested_k: u8) -> CompileResult<String> {
    if !(3..=64).contains(&requested_k) {
        return Err(CompilerError::plain(
            "analysis palette k must be an integer between 3 and 64",
        ));
    }

    let intake = inspect_image("analysis-source", bytes)?;
    let format = image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| CompilerError::plain(error.to_string()))?
        .format()
        .ok_or_else(|| CompilerError::plain("Unsupported image format"))?;
    let (pixels, width, height) =
        source_pixels(bytes).map_err(|error| CompilerError::plain(error.to_string()))?;
    let (analysis_pixels, analysis_width, analysis_height) = bounded_sample(&pixels, width, height);
    let palette = palette_for_pixels(&analysis_pixels, requested_k as usize)
        .map_err(|error| CompilerError::plain(error.to_string()))?;
    let index_map = palette_index_map(&analysis_pixels, &palette);
    let structure =
        calculate_structure(&analysis_pixels, analysis_width, analysis_height, &palette);
    let analysis = IngredientAnalysis {
        schema_version: "robby-ingredients-v1".to_string(),
        source: SourceIngredients {
            byte_sha256: intake.obverse.byte_sha256,
            pixel_sha256: intake.obverse.pixel_sha256,
            byte_size: intake.obverse.byte_size,
            width,
            height,
            aspect_ratio: f64::from(width) / f64::from(height.max(1)),
            orientation: intake.obverse.orientation,
            colour_profile: intake.obverse.colour_profile,
        },
        evidence: EvidenceIngredients {
            exif: extraction_state(&intake.evidence.exif.state),
            iptc: extraction_state(&intake.evidence.iptc.state),
            xmp: extraction_state(&intake.evidence.xmp.state),
            gps: extraction_state(&intake.evidence.gps.state),
            c2pa: intake
                .evidence
                .c2pa
                .value
                .map(|value| format!("{:?}", value.state).to_lowercase())
                .unwrap_or_else(|| "unsupported".to_string()),
        },
        palette: PaletteIngredients {
            requested_k,
            method: "median_cut".to_string(),
            ordering: "frequency_desc_then_rgb_asc".to_string(),
            entries: palette
                .iter()
                .map(|entry| PaletteIngredientEntry {
                    hex: entry.hex.clone(),
                    rgb: entry.rgb,
                    pixels: entry.weight,
                    share_percent: (entry.weight as f64 * 100.0) / analysis_pixels.len() as f64,
                    rank: entry.rank,
                })
                .collect(),
            index_map_sha256: digest_bytes(&index_map),
        },
        identity: IdentityIngredients {
            perceptual_hash: average_hash(&analysis_pixels, analysis_width, analysis_height),
        },
        terrain: gps_gated_terrain(bytes, format),
        structure,
    };
    serde_json::to_string(&analysis).map_err(|error| {
        CompilerError::plain(format!("Unable to serialize ingredient analysis: {error}"))
    })
}

/// The GPS-seeded coarse terrain field on its own — `null` when the source
/// carries no usable GPS coordinates. Same payload `analyze_image_json`
/// embeds under `terrain`, produced without the full ingredient pass.
pub fn generalized_terrain_json(bytes: &[u8]) -> CompileResult<String> {
    let format = image::ImageReader::new(std::io::Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| CompilerError::plain(error.to_string()))?
        .format()
        .ok_or_else(|| CompilerError::plain("Unsupported image format"))?;
    let terrain = gps_gated_terrain(bytes, format);
    serde_json::to_string(&terrain).map_err(|error| {
        CompilerError::plain(format!("Unable to serialize generalized terrain: {error}"))
    })
}

/// GPS evidence gates whether a terrain is published at all, but the field is
/// seeded by the source bytes — never by coordinates. Seeding it from the
/// coarse GPS band would let anyone enumerate the ~648 possible bands and
/// recover the photograph's 10° cell from the published heights.
fn gps_gated_terrain(bytes: &[u8], format: image::ImageFormat) -> Option<TerrainIngredients> {
    crate::intake::generalized_gps_seed(bytes, format)
        .map(|_| generalized_terrain(source_terrain_seed(bytes)))
}

fn source_terrain_seed(bytes: &[u8]) -> u64 {
    let digest = Sha256::digest(bytes);
    u64::from_be_bytes(digest[..8].try_into().expect("sha256 is 32 bytes"))
}

/// Reduce only expensive visual measurements to a deterministic bounded sample.
/// Full source and canonical-pixel hashes still use every pixel above.
fn generalized_terrain(seed: u64) -> TerrainIngredients {
    let grid_size = 16;
    let mut state = seed;
    let heights = (0..grid_size * grid_size)
        .map(|index| {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            let distance = ((index % grid_size) as i32 - (grid_size / 2) as i32).unsigned_abs()
                + ((index / grid_size) as i32 - (grid_size / 2) as i32).unsigned_abs();
            ((state as u8).saturating_add((distance as u8).saturating_mul(3))) / 2
        })
        .collect();
    TerrainIngredients {
        representation: "gps-gated-source-seeded-terrain".to_string(),
        grid_size,
        heights,
    }
}

fn bounded_sample(pixels: &[[u8; 3]], width: u32, height: u32) -> (Vec<[u8; 3]>, u32, u32) {
    if pixels.len() <= MAX_ANALYSIS_PIXELS {
        return (pixels.to_vec(), width, height);
    }
    let stride = ((pixels.len() as f64 / MAX_ANALYSIS_PIXELS as f64)
        .sqrt()
        .ceil() as u32)
        .max(1);
    let sampled_width = width.div_ceil(stride);
    let sampled_height = height.div_ceil(stride);
    let mut sampled = Vec::with_capacity((sampled_width * sampled_height) as usize);
    for y in (0..height).step_by(stride as usize) {
        for x in (0..width).step_by(stride as usize) {
            sampled.push(pixels[(y * width + x) as usize]);
        }
    }
    (sampled, sampled_width, sampled_height)
}

fn extraction_state(state: &crate::intake::ExtractionState) -> String {
    format!("{:?}", state).to_lowercase()
}

fn calculate_structure(
    pixels: &[[u8; 3]],
    width: u32,
    height: u32,
    palette: &[PaletteEntry],
) -> StructureIngredients {
    let grid = ANALYSIS_GRID_SIZE;
    let mut cells = vec![CellAccumulator::new(palette.len()); grid * grid];
    let mut bands = vec![0_u32; grid];
    for y in 0..height {
        for x in 0..width {
            let pixel = pixels[(y * width + x) as usize];
            let luminance = luminance(pixel);
            let band = (usize::from(luminance) * grid / 256).min(grid - 1);
            bands[band] += 1;
            let column = (x as usize * grid / width.max(1) as usize).min(grid - 1);
            let row = (y as usize * grid / height.max(1) as usize).min(grid - 1);
            let cell = &mut cells[row * grid + column];
            cell.count += 1;
            cell.luminance_sum += u64::from(luminance);
            cell.luminance_square_sum += u64::from(luminance) * u64::from(luminance);
            let rank = nearest_palette_index(&pixel, palette);
            cell.palette_counts[rank] += 1;
        }
    }

    let spatial_cells: Vec<SpatialCell> = cells.iter().map(|cell| cell.finish()).collect();
    let edge_field = spatial_cells
        .iter()
        .enumerate()
        .map(|(index, cell)| {
            let row = index / grid;
            let column = index % grid;
            let right = spatial_cells[row * grid + (column + 1).min(grid - 1)].mean_luminance;
            let down = spatial_cells[((row + 1).min(grid - 1)) * grid + column].mean_luminance;
            let dx = i16::from(cell.mean_luminance) - i16::from(right);
            let dy = i16::from(cell.mean_luminance) - i16::from(down);
            ((f64::from(dx.abs()) + f64::from(dy.abs())) * 0.5)
                .round()
                .min(255.0) as u8
        })
        .collect();
    let texture_field = spatial_cells.iter().map(|cell| cell.texture).collect();
    StructureIngredients {
        grid_size: grid,
        luminance_bands: bands,
        spatial_cells,
        edge_field,
        texture_field,
    }
}

#[derive(Clone)]
struct CellAccumulator {
    count: u64,
    luminance_sum: u64,
    luminance_square_sum: u64,
    palette_counts: Vec<u32>,
}

impl CellAccumulator {
    fn new(palette_len: usize) -> Self {
        Self {
            count: 0,
            luminance_sum: 0,
            luminance_square_sum: 0,
            palette_counts: vec![0; palette_len],
        }
    }

    fn finish(&self) -> SpatialCell {
        let count = self.count.max(1);
        let mean = self.luminance_sum / count;
        let variance = self.luminance_square_sum / count - mean * mean;
        let dominant = self
            .palette_counts
            .iter()
            .enumerate()
            .max_by_key(|(rank, count)| (**count, std::cmp::Reverse(*rank)))
            .map(|(rank, _)| rank)
            .unwrap_or(0);
        let palette_mix = self
            .palette_counts
            .iter()
            .map(|value| ((*value as u64 * 255) / count).min(255) as u8)
            .collect();
        SpatialCell {
            dominant_palette_rank: dominant,
            palette_mix,
            mean_luminance: mean.min(255) as u8,
            texture: (variance as f64).sqrt().round().min(255.0) as u8,
        }
    }
}

fn luminance(pixel: [u8; 3]) -> u8 {
    (0.2126 * f64::from(pixel[0]) + 0.7152 * f64::from(pixel[1]) + 0.0722 * f64::from(pixel[2]))
        .round()
        .min(255.0) as u8
}

fn average_hash(pixels: &[[u8; 3]], width: u32, height: u32) -> String {
    let mut samples = [0_u8; 64];
    for row in 0..8 {
        for column in 0..8 {
            let x = ((column * 2 + 1) as u32 * width / 16).min(width.saturating_sub(1));
            let y = ((row * 2 + 1) as u32 * height / 16).min(height.saturating_sub(1));
            samples[row * 8 + column] = luminance(pixels[(y * width + x) as usize]);
        }
    }
    let mean = samples.iter().map(|value| u32::from(*value)).sum::<u32>() / 64;
    let mut value = 0_u64;
    for sample in samples {
        value = (value << 1) | u64::from(sample >= mean as u8);
    }
    format!("{value:016X}")
}

fn digest_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[cfg(test)]
mod bounded_sample_tests {
    use super::{bounded_sample, MAX_ANALYSIS_PIXELS};

    #[test]
    fn expensive_analysis_sample_never_exceeds_pixel_budget() {
        let pixels = vec![[12_u8, 34, 56]; 2_000_000];
        let (sampled, width, height) = bounded_sample(&pixels, 2000, 1000);
        assert!(sampled.len() <= MAX_ANALYSIS_PIXELS);
        assert_eq!(sampled.len(), (width * height) as usize);
    }
}
