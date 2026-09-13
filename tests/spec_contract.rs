//! Reproduction tests for divergences between TECH-SPEC and the compiler.
//!
//! Each test asserts the documented contract. A failure demonstrates the bug.

use robby_compiler::compile_source;
use robby_compiler::render::{render_reverse, RenderSettings};

fn bmp(width: u32, height: u32, salt: u8) -> Vec<u8> {
    let row_size = (width * 3).div_ceil(4) * 4;
    let pixel_bytes = row_size * height;
    let file_size = 54 + pixel_bytes;
    let mut out = vec![0_u8; file_size as usize];
    out[0..2].copy_from_slice(b"BM");
    out[2..6].copy_from_slice(&file_size.to_le_bytes());
    out[10..14].copy_from_slice(&54_u32.to_le_bytes());
    out[14..18].copy_from_slice(&40_u32.to_le_bytes());
    out[18..22].copy_from_slice(&(width as i32).to_le_bytes());
    out[22..26].copy_from_slice(&(height as i32).to_le_bytes());
    out[26..28].copy_from_slice(&1_u16.to_le_bytes());
    out[28..30].copy_from_slice(&24_u16.to_le_bytes());
    out[34..38].copy_from_slice(&pixel_bytes.to_le_bytes());
    for y in 0..height {
        for x in 0..width {
            let offset = 54 + (y * row_size + x * 3) as usize;
            let n = (x * 37 + y * 71 + u32::from(salt)) as u8;
            out[offset..offset + 3].copy_from_slice(&[n.wrapping_mul(3), n.wrapping_add(41), n]);
        }
    }
    out
}

fn png_dimensions(png: &[u8]) -> (u32, u32) {
    assert_eq!(&png[0..8], b"\x89PNG\r\n\x1a\n");
    let width = u32::from_be_bytes(png[16..20].try_into().unwrap());
    let height = u32::from_be_bytes(png[20..24].try_into().unwrap());
    (width, height)
}

// TECH-SPEC §3: "Commands must appear in this order." The validator enforces
// `base` first and `output` last but does not order `palette` before `reverse`.
#[test]
fn rejects_palette_declared_after_reverse() {
    let source = r#"base("image.jpg")
reverse(mode: "negative")
palette(k: 8)
output(obverse: "image.jpg", reverse: "transient", manifest: "transient")
"#;
    let error = compile_source(source)
        .expect_err("palette after reverse violates the documented command order");
    assert!(error.message.contains("order") || error.message.contains("before"));
}

// TECH-SPEC §3: reverse and manifest output targets must be "transient".
#[test]
fn rejects_non_transient_reverse_target() {
    let source = r#"base("image.jpg")
palette(k: 8)
reverse(mode: "negative")
output(obverse: "image.jpg", reverse: "back.png", manifest: "transient")
"#;
    let error = compile_source(source).expect_err("a durable reverse path must be a compile error");
    assert!(error.message.contains("transient"));
}

#[test]
fn rejects_non_transient_manifest_target() {
    let source = r#"base("image.jpg")
palette(k: 8)
reverse(mode: "negative")
output(obverse: "image.jpg", reverse: "transient", manifest: "manifest.json")
"#;
    let error =
        compile_source(source).expect_err("a durable manifest path must be a compile error");
    assert!(error.message.contains("transient"));
}

// The validator and `render_reverse` both accept dimensions in 1..=4096, but the
// negative module silently clamps to a 64px minimum. An accepted setting must
// either be honored exactly or rejected up front.
#[test]
fn honors_or_rejects_declared_dimensions_below_sixty_four() {
    let settings = RenderSettings {
        mode: "negative".to_string(),
        k: 3,
        width: Some(32),
        height: Some(48),
        ..RenderSettings::default()
    };
    match render_reverse(&bmp(64, 64, 9), &settings) {
        Err(_) => {}
        Ok(result) => {
            assert_eq!(
                png_dimensions(&result.png),
                (32, 48),
                "accepted settings produced a different output size"
            );
        }
    }
}
