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

fn settings(k: u8) -> RenderSettings {
    RenderSettings {
        mode: "negative".to_string(),
        k,
        width: None,
        height: None,
    }
}

#[test]
fn identical_input_is_byte_identical() {
    let source = bmp(64, 48, 1);
    let first = render_reverse(&source, &settings(8)).expect("first render");
    let second = render_reverse(&source, &settings(8)).expect("second render");
    assert_eq!(first.png, second.png);
    assert_eq!(first.manifest.output_sha256, second.manifest.output_sha256);
    assert_eq!(first.manifest.derived_seed, second.manifest.derived_seed);
}

#[test]
fn one_pixel_resize_changes_seed_and_output() {
    let original = render_reverse(&bmp(64, 48, 2), &settings(8)).expect("original");
    let resized = render_reverse(&bmp(65, 48, 2), &settings(8)).expect("one-pixel resize");
    assert_ne!(
        original.manifest.source_obverse_sha256,
        resized.manifest.source_obverse_sha256
    );
    assert_ne!(
        original.manifest.derived_seed,
        resized.manifest.derived_seed
    );
    assert_ne!(
        original.manifest.output_sha256,
        resized.manifest.output_sha256
    );
    assert_ne!(original.png, resized.png);
}

#[test]
fn changing_k_is_distinct_and_reproducible() {
    let source = bmp(64, 48, 3);
    let eight = render_reverse(&source, &settings(8)).expect("k=8");
    let sixteen = render_reverse(&source, &settings(16)).expect("k=16");
    let sixteen_again = render_reverse(&source, &settings(16)).expect("k=16 repeat");
    assert_ne!(
        eight.manifest.script_settings_sha256,
        sixteen.manifest.script_settings_sha256
    );
    assert_ne!(eight.png, sixteen.png);
    assert_eq!(sixteen.png, sixteen_again.png);
    assert_eq!(eight.manifest.colour_swatches.len(), 8);
    assert_eq!(sixteen.manifest.colour_swatches.len(), 16);
}

#[test]
fn source_bytes_not_just_decoded_pixels_drive_the_seed() {
    let first_source = bmp(32, 24, 4);
    let mut second_source = first_source.clone();
    second_source[6] = 1; // reserved BMP header byte; decoded RGB is unchanged.
    let first = render_reverse(&first_source, &settings(8)).expect("first");
    let second = render_reverse(&second_source, &settings(8)).expect("second");
    assert_ne!(
        first.manifest.source_obverse_sha256,
        second.manifest.source_obverse_sha256
    );
    assert_ne!(first.manifest.derived_seed, second.manifest.derived_seed);
    assert_ne!(first.png, second.png);
}

#[test]
fn rejects_unknown_modules_invalid_k_and_invalid_images() {
    let source = bmp(16, 16, 5);
    let mut unknown = settings(8);
    unknown.mode = "unknown-mode".into();
    assert!(render_reverse(&source, &unknown)
        .unwrap_err()
        .to_string()
        .contains("render module"));
    assert!(render_reverse(&source, &settings(2))
        .unwrap_err()
        .to_string()
        .contains("between 3 and 16"));
    assert!(render_reverse(b"not an image", &settings(8))
        .unwrap_err()
        .to_string()
        .contains("decode"));

    let mut too_wide = settings(8);
    too_wide.width = Some(4097);
    assert!(render_reverse(&source, &too_wide)
        .unwrap_err()
        .to_string()
        .contains("between 1 and 4096"));

    let tiny = bmp(1, 1, 7);
    assert!(render_reverse(&tiny, &settings(8))
        .unwrap_err()
        .to_string()
        .contains("fewer pixels"));
}

#[test]
fn registry_exposes_negative_as_the_only_v1_backend() {
    assert_eq!(robby_compiler::render::render_module_names(), &["negative"]);
}

#[test]
fn manifest_is_complete_and_declares_no_cached_intermediate() {
    let result = render_reverse(&bmp(16, 16, 8), &settings(8)).expect("render");
    assert_eq!(result.manifest.version, "robby-render-manifest-v1");
    assert_eq!(result.manifest.render_module, "negative");
    assert_eq!(result.manifest.source_obverse_sha256.len(), 64);
    assert_eq!(result.manifest.script_settings_sha256.len(), 64);
    assert_eq!(result.manifest.derived_seed.len(), 64);
    assert_eq!(result.manifest.output_sha256.len(), 64);
    assert_eq!(result.manifest.cached_intermediate, None);
}
