//! Pure, deterministic reverse generation shared by native and WebAssembly builds.
//!
//! Like LLVM target backends, `RenderModule` implementations are selected from a
//! registry while the compiler and render inputs remain stable. Modules receive
//! only flat colour swatches, settings, and a deterministic PRNG stream.

use std::fmt;
use std::io::Cursor;

use image::{DynamicImage, ImageBuffer, ImageFormat, Rgb, RgbImage};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use zune_core::{colorspace::ColorSpace, options::DecoderOptions};
use zune_jpeg::JpegDecoder;

const MODULE_NAMES: &[&str] = &["negative"];
const OUTPUT_WIDTH: u32 = 1024;
const OUTPUT_HEIGHT: u32 = 768;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenderSettings {
    pub mode: String,
    pub k: u8,
    pub width: Option<u32>,
    pub height: Option<u32>,
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
        swatches: &[[u8; 3]],
        settings: &RenderSettings,
        rng: &mut SplitMix64,
    ) -> RgbImage;
}

struct NegativeModule;

impl RenderModule for NegativeModule {
    fn name(&self) -> &'static str {
        "negative"
    }

    fn render(
        &self,
        swatches: &[[u8; 3]],
        settings: &RenderSettings,
        rng: &mut SplitMix64,
    ) -> RgbImage {
        let width = settings.width.unwrap_or(OUTPUT_WIDTH).clamp(64, 4096);
        let height = settings.height.unwrap_or(OUTPUT_HEIGHT).clamp(64, 4096);
        let inverted: Vec<[u8; 3]> = swatches
            .iter()
            .map(|color| [255 - color[0], 255 - color[1], 255 - color[2]])
            .collect();
        let mut image = ImageBuffer::new(width, height);
        let bands = (inverted.len() as u32).max(1);
        let phase = rng.next_u64();
        let x_shift = (phase as u32) % width;
        let y_shift = ((phase >> 32) as u32) % height;
        for y in 0..height {
            for x in 0..width {
                let diagonal = ((x + x_shift) / (width / bands).max(1)
                    + (y + y_shift) / (height / bands).max(1))
                    as usize;
                let noise = mix_coordinates(x, y, rng.seed);
                let color_index = ((diagonal as u64) ^ noise) % inverted.len() as u64;
                let color = inverted[color_index as usize];
                image.put_pixel(x, y, Rgb(color));
            }
        }
        image
    }
}

static NEGATIVE: NegativeModule = NegativeModule;
static MODULES: [&dyn RenderModule; 1] = [&NEGATIVE];

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
    let module = MODULES
        .iter()
        .copied()
        .find(|module| module.name() == settings.mode)
        .ok_or_else(|| RenderError(format!("unknown render module `{}`", settings.mode)))?;
    let source_hash = sha256(source_bytes);
    let settings_json = serde_json::to_vec(settings)
        .map_err(|error| RenderError(format!("could not serialize render settings: {error}")))?;
    let settings_hash = sha256(&settings_json);

    // This seed is a reproducibility mechanism, not encryption and not a
    // cryptographic key. SHA-256 supplies avalanche behavior; SplitMix64 only
    // expands those deterministic bytes into the module's procedural stream.
    let mut seed_material = Vec::with_capacity(64);
    seed_material.extend_from_slice(&source_hash);
    seed_material.extend_from_slice(&settings_hash);
    let derived = sha256(&seed_material);
    let seed = u64::from_be_bytes(derived[0..8].try_into().expect("eight-byte seed"));

    let decoded = decode_source(source_bytes)?;
    let swatches = kmeans_palette(&decoded, settings.k as usize)?;
    let mut rng = SplitMix64::new(seed);
    let image = module.render(&swatches, settings, &mut rng);
    let mut png = Vec::new();
    DynamicImage::ImageRgb8(image)
        .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
        .map_err(|error| RenderError(format!("could not encode reverse PNG: {error}")))?;
    let output_hash = sha256(&png);
    Ok(RenderResult {
        png,
        manifest: RenderManifest {
            version: "robby-render-manifest-v1".into(),
            source_obverse_sha256: hex(&source_hash),
            script_settings_sha256: hex(&settings_hash),
            derived_seed: hex(&derived),
            output_sha256: hex(&output_hash),
            render_module: module.name().into(),
            colour_swatches: swatches
                .iter()
                .map(|color| format!("#{:02X}{:02X}{:02X}", color[0], color[1], color[2]))
                .collect(),
            cached_intermediate: None,
        },
    })
}

fn decode_source(source_bytes: &[u8]) -> Result<DynamicImage, RenderError> {
    if source_bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        // Native zune-jpeg enables platform SIMD by default while wasm32 uses
        // scalar routines. Their rounding can differ by one channel value,
        // which k-means then amplifies into target-dependent swatches. Force
        // the scalar RGB path so identical JPEG bytes decode identically.
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

fn kmeans_palette(image: &DynamicImage, k: usize) -> Result<Vec<[u8; 3]>, RenderError> {
    let rgb = image.to_rgb8();
    let pixels: Vec<[u8; 3]> = rgb.pixels().map(|pixel| pixel.0).collect();
    if pixels.len() < k {
        return Err(RenderError(
            "source image has fewer pixels than palette k".into(),
        ));
    }
    let mut centers: Vec<[u32; 3]> = (0..k)
        .map(|index| {
            let pixel = pixels[index * (pixels.len() - 1) / (k - 1)];
            [
                u32::from(pixel[0]),
                u32::from(pixel[1]),
                u32::from(pixel[2]),
            ]
        })
        .collect();
    let mut assignments = vec![0_usize; pixels.len()];
    for _ in 0..16 {
        for (position, pixel) in pixels.iter().enumerate() {
            assignments[position] = centers
                .iter()
                .enumerate()
                .min_by_key(|(_, center)| distance(pixel, center))
                .map(|(index, _)| index)
                .expect("at least one center");
        }
        let mut sums = vec![[0_u64; 3]; k];
        let mut counts = vec![0_u64; k];
        for (pixel, assignment) in pixels.iter().zip(&assignments) {
            counts[*assignment] += 1;
            for channel in 0..3 {
                sums[*assignment][channel] += u64::from(pixel[channel]);
            }
        }
        let mut changed = false;
        for index in 0..k {
            if counts[index] == 0 {
                continue;
            }
            let next = [
                (sums[index][0] / counts[index]) as u32,
                (sums[index][1] / counts[index]) as u32,
                (sums[index][2] / counts[index]) as u32,
            ];
            changed |= next != centers[index];
            centers[index] = next;
        }
        if !changed {
            break;
        }
    }
    let mut counts = vec![0_usize; k];
    for assignment in assignments {
        counts[assignment] += 1;
    }
    let mut indexed: Vec<(usize, [u32; 3], usize)> = centers
        .into_iter()
        .enumerate()
        .map(|(index, center)| (counts[index], center, index))
        .collect();
    indexed.sort_by(|left, right| {
        right
            .0
            .cmp(&left.0)
            .then_with(|| left.1.cmp(&right.1))
            .then_with(|| left.2.cmp(&right.2))
    });
    Ok(indexed
        .into_iter()
        .map(|(_, center, _)| [center[0] as u8, center[1] as u8, center[2] as u8])
        .collect())
}

fn distance(pixel: &[u8; 3], center: &[u32; 3]) -> u64 {
    (0..3)
        .map(|channel| {
            let difference = i64::from(pixel[channel]) - i64::from(center[channel]);
            (difference * difference) as u64
        })
        .sum()
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
