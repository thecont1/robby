//! Pure, deterministic reverse generation shared by native and WebAssembly builds.
//!
//! Phase 4 uses a deliberately small, portable median-cut quantizer. Pixels are
//! never interpreted semantically: the only inputs to the renderers are decoded
//! RGB samples, explicit settings, and a seed used for palette-grid arrangement.

use std::fmt;
use std::io::Cursor;

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgb, RgbImage};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zune_core::{colorspace::ColorSpace, options::DecoderOptions};
use zune_jpeg::JpegDecoder;

const MODULE_NAMES: &[&str] = &[
    "quantised_obverse",
    "palette_grid",
    "observability_sheet",
    "negative",
];
const PAPER: Rgb<u8> = Rgb([28, 26, 25]);
const INK: Rgb<u8> = Rgb([244, 239, 225]);
const VERMILION: Rgb<u8> = Rgb([227, 68, 47]);
const MUTED: Rgb<u8> = Rgb([88, 82, 74]);
const RULE: Rgb<u8> = Rgb([216, 206, 188]);
const OUTPUT_WIDTH: u32 = 1024;
const OUTPUT_HEIGHT: u32 = 768;
const MAX_MEDIAN_CUT_ITERATIONS: usize = 16;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct RenderSettings {
    pub mode: String,
    pub k: u8,
    pub width: Option<u32>,
    pub height: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cell: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaletteEntry {
    pub hex: String,
    pub rgb: [u8; 3],
    pub weight: u64,
    pub rank: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ArtifactDescriptor {
    pub media_type: String,
    pub width: u32,
    pub height: u32,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct RenderArtifacts {
    pub quantised_obverse: Option<ArtifactDescriptor>,
    pub palette_grid: Option<ArtifactDescriptor>,
    pub observability_sheet: Option<ArtifactDescriptor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenderManifest {
    pub version: String,
    pub source_obverse_sha256: String,
    pub script_settings_sha256: String,
    pub derived_seed: String,
    pub output_sha256: String,
    pub render_module: String,
    pub colour_swatches: Vec<String>,
    pub cached_intermediate: Option<String>,
    pub palette_method: String,
    pub palette_parameters: PaletteParameters,
    pub palette: Vec<PaletteEntry>,
    pub palette_index_map_sha256: String,
    pub artifacts: RenderArtifacts,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaletteParameters {
    pub requested_colours: u8,
    pub max_iterations: usize,
    pub ordering: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderResult {
    pub png: Vec<u8>,
    pub manifest: RenderManifest,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderError(String);

impl fmt::Display for RenderError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for RenderError {}

pub trait RenderModule: Sync {
    fn name(&self) -> &'static str;
    fn render(
        &self,
        pixels: &[[u8; 3]],
        palette: &[PaletteEntry],
        settings: &RenderSettings,
        rng: &mut SplitMix64,
        source_width: u32,
        source_height: u32,
    ) -> RgbImage;
}

struct QuantisedObverseModule;

impl RenderModule for QuantisedObverseModule {
    fn name(&self) -> &'static str {
        "quantised_obverse"
    }

    fn render(
        &self,
        pixels: &[[u8; 3]],
        palette: &[PaletteEntry],
        settings: &RenderSettings,
        _rng: &mut SplitMix64,
        source_width: u32,
        source_height: u32,
    ) -> RgbImage {
        let width = settings.width.unwrap_or(source_width);
        let height = settings.height.unwrap_or(source_height);
        let mut image = ImageBuffer::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let source_x = (u64::from(x) * u64::from(source_width) / u64::from(width)) as u32;
                let source_y = (u64::from(y) * u64::from(source_height) / u64::from(height)) as u32;
                let pixel = pixels[(source_y * source_width + source_x) as usize];
                let index = nearest_palette_index(&pixel, palette);
                image.put_pixel(x, y, Rgb(palette[index].rgb));
            }
        }
        image
    }
}

struct PaletteGridModule;

impl RenderModule for PaletteGridModule {
    fn name(&self) -> &'static str {
        "palette_grid"
    }

    fn render(
        &self,
        _pixels: &[[u8; 3]],
        palette: &[PaletteEntry],
        settings: &RenderSettings,
        rng: &mut SplitMix64,
        source_width: u32,
        source_height: u32,
    ) -> RgbImage {
        let width = settings.width.unwrap_or(source_width);
        let height = settings.height.unwrap_or(source_height);
        let cell = settings.cell.unwrap_or(10).max(1);
        let columns = width.div_ceil(cell);
        let rows = height.div_ceil(cell);
        let tile_count = (columns * rows) as usize;
        let mut tiles = weighted_tile_indices(palette, tile_count);
        deterministic_shuffle(&mut tiles, rng);
        let mut image = ImageBuffer::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let tile = ((y / cell) * columns + x / cell) as usize;
                image.put_pixel(x, y, Rgb(palette[tiles[tile]].rgb));
            }
        }
        image
    }
}

struct ObservabilitySheetModule;

impl RenderModule for ObservabilitySheetModule {
    fn name(&self) -> &'static str {
        "observability_sheet"
    }

    fn render(
        &self,
        _pixels: &[[u8; 3]],
        palette: &[PaletteEntry],
        _settings: &RenderSettings,
        rng: &mut SplitMix64,
        _source_width: u32,
        _source_height: u32,
    ) -> RgbImage {
        let mut image = ImageBuffer::from_pixel(OUTPUT_WIDTH, OUTPUT_HEIGHT, PAPER);
        fill_rect(&mut image, 0, 0, OUTPUT_WIDTH, 72, VERMILION);
        fill_rect(&mut image, 36, 24, 36, 24, INK);
        fill_rect(&mut image, 80, 24, 12, 24, PAPER);
        fill_rect(&mut image, OUTPUT_WIDTH - 72, 24, 36, 24, PAPER);

        draw_weighted_swatches(&mut image, 36, 108, OUTPUT_WIDTH - 72, 84, palette);

        let field_x = OUTPUT_WIDTH / 2 + 12;
        let field_w = OUTPUT_WIDTH / 2 - 48;
        draw_seeded_field(&mut image, field_x, 228, field_w, 360, palette, rng);
        stroke_rect(&mut image, field_x, 228, field_w, 360, RULE);

        draw_hash_bars(&mut image, 36, 228, OUTPUT_WIDTH / 2 - 72, 72, rng.seed);
        draw_binding_mark(&mut image, 36, 332, 148, rng.seed);
        fill_rect(&mut image, 200, 332, OUTPUT_WIDTH / 2 - 236, 8, MUTED);
        fill_rect(&mut image, 200, 352, OUTPUT_WIDTH / 2 - 280, 8, RULE);
        fill_rect(&mut image, 200, 372, 88, 8, VERMILION);

        fill_rect(
            &mut image,
            0,
            OUTPUT_HEIGHT - 56,
            OUTPUT_WIDTH,
            56,
            Rgb([18, 16, 15]),
        );
        fill_rect(&mut image, 36, OUTPUT_HEIGHT - 36, 96, 8, MUTED);
        fill_rect(&mut image, 148, OUTPUT_HEIGHT - 36, 96, 8, MUTED);
        fill_rect(&mut image, 260, OUTPUT_HEIGHT - 36, 128, 8, VERMILION);
        image
    }
}

struct NegativeModule;

impl RenderModule for NegativeModule {
    fn name(&self) -> &'static str {
        "negative"
    }

    fn render(
        &self,
        _pixels: &[[u8; 3]],
        palette: &[PaletteEntry],
        settings: &RenderSettings,
        rng: &mut SplitMix64,
        source_width: u32,
        source_height: u32,
    ) -> RgbImage {
        let width = settings.width.unwrap_or(OUTPUT_WIDTH);
        let height = settings.height.unwrap_or(OUTPUT_HEIGHT);
        let inverted: Vec<PaletteEntry> = palette
            .iter()
            .map(|entry| PaletteEntry {
                rgb: [255 - entry.rgb[0], 255 - entry.rgb[1], 255 - entry.rgb[2]],
                ..entry.clone()
            })
            .collect();
        let mut image = ImageBuffer::new(width, height);
        let bands = (inverted.len() as u32).max(1);
        let phase = rng.next_u64();
        let x_shift = (phase as u32) % width;
        let y_shift = ((phase >> 32) as u32) % height;
        let _ = (source_width, source_height);
        for y in 0..height {
            for x in 0..width {
                let diagonal = ((x + x_shift) / (width / bands).max(1)
                    + (y + y_shift) / (height / bands).max(1))
                    as usize;
                let noise = mix_coordinates(x, y, rng.seed);
                let color_index = ((diagonal as u64) ^ noise) % inverted.len() as u64;
                image.put_pixel(x, y, Rgb(inverted[color_index as usize].rgb));
            }
        }
        image
    }
}

static QUANTISED_OBVERSE: QuantisedObverseModule = QuantisedObverseModule;
static PALETTE_GRID: PaletteGridModule = PaletteGridModule;
static OBSERVABILITY_SHEET: ObservabilitySheetModule = ObservabilitySheetModule;
static NEGATIVE: NegativeModule = NegativeModule;
static MODULES: [&dyn RenderModule; 4] = [
    &QUANTISED_OBVERSE,
    &PALETTE_GRID,
    &OBSERVABILITY_SHEET,
    &NEGATIVE,
];

pub fn render_module_names() -> &'static [&'static str] {
    MODULE_NAMES
}

pub fn render_reverse(
    source_bytes: &[u8],
    settings: &RenderSettings,
) -> Result<RenderResult, RenderError> {
    if !(3..=16).contains(&settings.k) {
        return Err(RenderError(
            "palette k must be an integer between 3 and 16".into(),
        ));
    }
    if settings
        .width
        .is_some_and(|value| value == 0 || value > 4096)
        || settings
            .height
            .is_some_and(|value| value == 0 || value > 4096)
    {
        return Err(RenderError(
            "render dimensions must be between 1 and 4096".into(),
        ));
    }
    if settings
        .cell
        .is_some_and(|value| value == 0 || value > 4096)
    {
        return Err(RenderError(
            "palette grid cell must be between 1 and 4096".into(),
        ));
    }
    let module = MODULES
        .iter()
        .copied()
        .find(|module| module.name() == settings.mode)
        .ok_or_else(|| RenderError(format!("unknown render module `{}`", settings.mode)))?;
    let source_hash = sha256(source_bytes);
    let settings_json = serde_json::to_vec(settings)
        .map_err(|error| RenderError(format!("could not serialize render settings: {error}")))?;
    let settings_hash = sha256(&settings_json);
    let mut seed_material = Vec::with_capacity(96);
    seed_material.extend_from_slice(&source_hash);
    seed_material.extend_from_slice(&settings_hash);
    let derived = sha256(&seed_material);
    let seed = u64::from_be_bytes(derived[0..8].try_into().expect("eight-byte seed"));

    let decoded = decode_source(source_bytes)?;
    let rgb = decoded.to_rgb8();
    let source_width = rgb.width();
    let source_height = rgb.height();
    let pixels: Vec<[u8; 3]> = rgb.pixels().map(|pixel| pixel.0).collect();
    let palette = median_cut_palette(&pixels, settings.k as usize)?;
    let index_map = palette_index_map(&pixels, &palette);
    let mut rng = SplitMix64::new(seed);
    let image = module.render(
        &pixels,
        &palette,
        settings,
        &mut rng,
        source_width,
        source_height,
    );
    let png = encode_png(image)?;
    let output_hash = sha256(&png);
    let index_hash = sha256(&index_map);
    let output_descriptor = ArtifactDescriptor {
        media_type: "image/png".into(),
        width: png_dimensions(&png).0,
        height: png_dimensions(&png).1,
        sha256: hex(&output_hash),
    };
    let mut artifacts = RenderArtifacts::default();
    match settings.mode.as_str() {
        "quantised_obverse" => artifacts.quantised_obverse = Some(output_descriptor),
        "palette_grid" => artifacts.palette_grid = Some(output_descriptor),
        "observability_sheet" => artifacts.observability_sheet = Some(output_descriptor),
        _ => {}
    }
    let manifest_palette = palette
        .iter()
        .enumerate()
        .map(|(rank, entry)| PaletteEntry {
            rank,
            ..entry.clone()
        })
        .collect::<Vec<_>>();
    Ok(RenderResult {
        png,
        manifest: RenderManifest {
            version: "robby-render-manifest-v1".into(),
            source_obverse_sha256: hex(&source_hash),
            script_settings_sha256: hex(&settings_hash),
            derived_seed: hex(&derived),
            output_sha256: hex(&output_hash),
            render_module: module.name().into(),
            colour_swatches: manifest_palette
                .iter()
                .map(|entry| entry.hex.clone())
                .collect(),
            cached_intermediate: None,
            palette_method: "median_cut".into(),
            palette_parameters: PaletteParameters {
                requested_colours: settings.k,
                max_iterations: MAX_MEDIAN_CUT_ITERATIONS,
                ordering: "frequency_desc_then_rgb_asc".into(),
            },
            palette: manifest_palette,
            palette_index_map_sha256: hex(&index_hash),
            artifacts,
        },
    })
}

fn encode_png(image: RgbImage) -> Result<Vec<u8>, RenderError> {
    let mut png = Vec::new();
    DynamicImage::ImageRgb8(image)
        .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
        .map_err(|error| RenderError(format!("could not encode reverse PNG: {error}")))?;
    Ok(png)
}

fn png_dimensions(png: &[u8]) -> (u32, u32) {
    (
        u32::from_be_bytes(png[16..20].try_into().expect("png width")),
        u32::from_be_bytes(png[20..24].try_into().expect("png height")),
    )
}

fn decode_source(source_bytes: &[u8]) -> Result<DynamicImage, RenderError> {
    if source_bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        let options = DecoderOptions::default()
            .set_use_unsafe(false)
            .jpeg_set_out_colorspace(ColorSpace::RGB);
        let mut decoder = JpegDecoder::new_with_options(source_bytes, options);
        let pixels = decoder
            .decode()
            .map_err(|error| RenderError(format!("could not decode source image: {error}")))?;
        let (width, height) = decoder
            .dimensions()
            .ok_or_else(|| RenderError("could not decode source image dimensions".into()))?;
        let image = RgbImage::from_raw(width as u32, height as u32, pixels)
            .ok_or_else(|| RenderError("decoded source image has an invalid RGB buffer".into()))?;
        return Ok(DynamicImage::ImageRgb8(image));
    }
    image::load_from_memory(source_bytes)
        .map_err(|error| RenderError(format!("could not decode source image: {error}")))
}

#[derive(Clone)]
struct ColourBox {
    pixels: Vec<[u8; 3]>,
    ordinal: usize,
}

fn median_cut_palette(pixels: &[[u8; 3]], k: usize) -> Result<Vec<PaletteEntry>, RenderError> {
    if pixels.len() < k {
        return Err(RenderError(
            "source image has fewer pixels than palette k".into(),
        ));
    }
    let mut boxes = vec![ColourBox {
        pixels: pixels.to_vec(),
        ordinal: 0,
    }];
    for ordinal in 1..MAX_MEDIAN_CUT_ITERATIONS {
        if boxes.len() >= k {
            break;
        }
        let Some(index) = boxes
            .iter()
            .enumerate()
            .filter(|(_, b)| b.pixels.len() > 1 && box_range(&b.pixels) > 0)
            .max_by_key(|(_, b)| {
                (
                    box_range(&b.pixels),
                    b.pixels.len(),
                    std::cmp::Reverse(b.ordinal),
                )
            })
            .map(|(i, _)| i)
        else {
            break;
        };
        let mut selected = boxes.remove(index);
        let channel = widest_channel(&selected.pixels);
        selected
            .pixels
            .sort_by_key(|pixel| (pixel[channel], pixel[0], pixel[1], pixel[2]));
        let midpoint = selected.pixels.len() / 2;
        let right = selected.pixels.split_off(midpoint);
        boxes.push(ColourBox {
            pixels: selected.pixels,
            ordinal,
        });
        boxes.push(ColourBox {
            pixels: right,
            ordinal: ordinal + 1,
        });
    }
    let mut palette = boxes
        .into_iter()
        .map(|b| {
            let mut sums = [0_u64; 3];
            for pixel in &b.pixels {
                for channel in 0..3 {
                    sums[channel] += u64::from(pixel[channel]);
                }
            }
            let count = b.pixels.len() as u64;
            let rgb = [
                (sums[0] / count) as u8,
                (sums[1] / count) as u8,
                (sums[2] / count) as u8,
            ];
            PaletteEntry {
                hex: format!("#{:02X}{:02X}{:02X}", rgb[0], rgb[1], rgb[2]),
                rgb,
                weight: count,
                rank: 0,
            }
        })
        .collect::<Vec<_>>();
    palette.sort_by(|left, right| {
        right
            .weight
            .cmp(&left.weight)
            .then_with(|| left.rgb.cmp(&right.rgb))
    });
    for (rank, entry) in palette.iter_mut().enumerate() {
        entry.rank = rank;
    }
    Ok(palette)
}

fn box_range(pixels: &[[u8; 3]]) -> u16 {
    let mut min = [u8::MAX; 3];
    let mut max = [u8::MIN; 3];
    for pixel in pixels {
        for channel in 0..3 {
            min[channel] = min[channel].min(pixel[channel]);
            max[channel] = max[channel].max(pixel[channel]);
        }
    }
    u16::from(max[0] - min[0])
        .max(u16::from(max[1] - min[1]))
        .max(u16::from(max[2] - min[2]))
}

fn widest_channel(pixels: &[[u8; 3]]) -> usize {
    let mut min = [u8::MAX; 3];
    let mut max = [u8::MIN; 3];
    for pixel in pixels {
        for channel in 0..3 {
            min[channel] = min[channel].min(pixel[channel]);
            max[channel] = max[channel].max(pixel[channel]);
        }
    }
    (0..3)
        .max_by_key(|channel| (max[*channel] - min[*channel], std::cmp::Reverse(*channel)))
        .unwrap_or(0)
}

fn nearest_palette_index(pixel: &[u8; 3], palette: &[PaletteEntry]) -> usize {
    palette
        .iter()
        .enumerate()
        .min_by_key(|(index, entry)| (distance(pixel, &entry.rgb), *index))
        .map(|(index, _)| index)
        .unwrap_or(0)
}

fn palette_index_map(pixels: &[[u8; 3]], palette: &[PaletteEntry]) -> Vec<u8> {
    pixels
        .iter()
        .map(|pixel| nearest_palette_index(pixel, palette) as u8)
        .collect()
}

fn distance(pixel: &[u8; 3], center: &[u8; 3]) -> u32 {
    (0..3)
        .map(|channel| {
            let difference = i32::from(pixel[channel]) - i32::from(center[channel]);
            (difference * difference) as u32
        })
        .sum()
}

fn weighted_tile_indices(palette: &[PaletteEntry], total: usize) -> Vec<usize> {
    if total == 0 || palette.is_empty() {
        return Vec::new();
    }
    let weight_total: u64 = palette.iter().map(|entry| entry.weight).sum::<u64>().max(1);
    let mut tiles = Vec::with_capacity(total);
    let mut remainders = Vec::new();
    for (index, entry) in palette.iter().enumerate() {
        let scaled = (entry.weight * total as u64) / weight_total;
        tiles.extend(std::iter::repeat_n(index, scaled as usize));
        remainders.push(((entry.weight * total as u64) % weight_total, index));
    }
    remainders.sort_by(|left, right| right.cmp(left));
    for (_, index) in remainders {
        if tiles.len() >= total {
            break;
        }
        tiles.push(index);
    }
    while tiles.len() < total {
        tiles.push(0);
    }
    tiles.truncate(total);
    tiles
}

fn deterministic_shuffle(values: &mut [usize], rng: &mut SplitMix64) {
    for index in (1..values.len()).rev() {
        let swap = (rng.next_u64() % (index as u64 + 1)) as usize;
        values.swap(index, swap);
    }
}

fn fill_rect(image: &mut RgbImage, x: u32, y: u32, width: u32, height: u32, color: Rgb<u8>) {
    let max_x = (x + width).min(image.width());
    let max_y = (y + height).min(image.height());
    for py in y..max_y {
        for px in x..max_x {
            image.put_pixel(px, py, color);
        }
    }
}

fn stroke_rect(image: &mut RgbImage, x: u32, y: u32, width: u32, height: u32, color: Rgb<u8>) {
    if width == 0 || height == 0 {
        return;
    }
    fill_rect(image, x, y, width, 1, color);
    fill_rect(image, x, y + height.saturating_sub(1), width, 1, color);
    fill_rect(image, x, y, 1, height, color);
    fill_rect(image, x + width.saturating_sub(1), y, 1, height, color);
}

fn draw_weighted_swatches(
    image: &mut RgbImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    palette: &[PaletteEntry],
) {
    if palette.is_empty() || width == 0 {
        return;
    }
    let weight_total = palette
        .iter()
        .map(|entry| entry.weight.max(1))
        .sum::<u64>()
        .max(1);
    let mut cursor = x;
    for (index, entry) in palette.iter().enumerate() {
        let remaining = palette.len() - index;
        let span = if remaining == 1 {
            x + width - cursor
        } else {
            ((entry.weight.max(1) * u64::from(width)) / weight_total).max(8) as u32
        };
        fill_rect(image, cursor, y, span, height, Rgb(entry.rgb));
        cursor = (cursor + span).min(x + width);
    }
}

fn draw_seeded_field(
    image: &mut RgbImage,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    palette: &[PaletteEntry],
    rng: &mut SplitMix64,
) {
    if palette.is_empty() || width == 0 || height == 0 {
        return;
    }
    let cell = 16_u32;
    let columns = width.div_ceil(cell);
    let rows = height.div_ceil(cell);
    let mut tiles = weighted_tile_indices(palette, (columns * rows) as usize);
    deterministic_shuffle(&mut tiles, rng);
    for row in 0..rows {
        for column in 0..columns {
            let tile = (row * columns + column) as usize;
            let color = Rgb(palette[tiles[tile]].rgb);
            fill_rect(
                image,
                x + column * cell,
                y + row * cell,
                cell.min(x + width - (x + column * cell)),
                cell.min(y + height - (y + row * cell)),
                color,
            );
        }
    }
}

fn draw_hash_bars(image: &mut RgbImage, x: u32, y: u32, width: u32, height: u32, seed: u64) {
    let bar_count = 16_u32;
    let bar_width = (width / bar_count).max(4);
    for index in 0..bar_count {
        let bit = (seed >> (index % 64)) & 1;
        let color = if bit == 1 { INK } else { MUTED };
        fill_rect(
            image,
            x + index * bar_width,
            y,
            bar_width.saturating_sub(3),
            height,
            color,
        );
    }
}

fn draw_binding_mark(image: &mut RgbImage, x: u32, y: u32, size: u32, seed: u64) {
    fill_rect(image, x, y, size, size, INK);
    for ring in 0..4 {
        let inset = 10 + ring * 12;
        let color = if (seed >> ring) & 1 == 1 {
            VERMILION
        } else {
            PAPER
        };
        stroke_rect(
            image,
            x + inset,
            y + inset,
            size.saturating_sub(inset * 2),
            size.saturating_sub(inset * 2),
            color,
        );
    }
    fill_rect(
        image,
        x + size / 2 - 6,
        y + 18,
        12,
        size.saturating_sub(36),
        PAPER,
    );
    fill_rect(
        image,
        x + 18,
        y + size / 2 - 6,
        size.saturating_sub(36),
        12,
        PAPER,
    );
}

fn mix_coordinates(x: u32, y: u32, seed: u64) -> u64 {
    let mut value =
        seed ^ u64::from(x).wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ u64::from(y).rotate_left(32);
    value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    value ^ (value >> 31)
}

fn sha256(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}
fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub struct SplitMix64 {
    state: u64,
    seed: u64,
}
impl SplitMix64 {
    fn new(seed: u64) -> Self {
        Self { state: seed, seed }
    }
    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut value = self.state;
        value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        value ^ (value >> 31)
    }
}
