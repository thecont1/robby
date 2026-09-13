use robby_compiler::render::{render_reverse, RenderSettings};

fn bmp(width: u32, height: u32) -> Vec<u8> {
    let row_size = (width * 3).div_ceil(4) * 4;
    let pixel_bytes = row_size * height;
    let file_size = 54 + pixel_bytes;
    let mut out = vec![0_u8; file_size as usize];
    out[0..2].copy_from_slice(b"BM");
    out[2..6].copy_from_slice(&file_size.to_le_bytes());
    out[10..14].copy_from_slice(&54_u32.to_le_bytes());
    out[14..18].copy_from_slice(&40_u32.to_le_bytes());
    out[18..22].copy_from_slice(&width.to_le_bytes());
    out[22..26].copy_from_slice(&height.to_le_bytes());
    out[26..28].copy_from_slice(&1_u16.to_le_bytes());
    out[28..30].copy_from_slice(&24_u16.to_le_bytes());
    out[34..38].copy_from_slice(&pixel_bytes.to_le_bytes());
    for y in 0..height {
        for x in 0..width {
            let offset = 54 + (y * row_size + x * 3) as usize;
            let pixel = match (x + y) % 4 {
                0 => [220, 30, 40],
                1 => [30, 180, 50],
                2 => [40, 70, 220],
                _ => [230, 210, 40],
            };
            out[offset..offset + 3].copy_from_slice(&pixel);
        }
    }
    out
}

fn settings(mode: &str) -> RenderSettings {
    RenderSettings {
        mode: mode.to_string(),
        k: 4,
        width: None,
        height: None,
        cell: Some(2),
        seed: Some("object-binding".to_string()),
    }
}

#[test]
fn quantised_obverse_is_source_sized_and_exposes_weighted_palette_and_index_map() {
    let result = render_reverse(&bmp(8, 6), &settings("quantised_obverse")).expect("render");
    assert_eq!(result.manifest.render_module, "quantised_obverse");
    assert_eq!(result.manifest.palette_method, "median_cut");
    assert_eq!(result.manifest.palette.len(), 4);
    assert_eq!(
        result
            .manifest
            .palette
            .iter()
            .map(|entry| entry.weight)
            .sum::<u64>(),
        48
    );
    assert_eq!(result.manifest.palette_index_map_sha256.len(), 64);
    assert_eq!(
        result
            .manifest
            .artifacts
            .quantised_obverse
            .as_ref()
            .unwrap()
            .width,
        8
    );
    assert_eq!(
        result
            .manifest
            .artifacts
            .quantised_obverse
            .as_ref()
            .unwrap()
            .height,
        6
    );
}

#[test]
fn palette_grid_uses_weighted_tiles_and_seed_changes_only_arrangement() {
    let source = bmp(12, 10);
    let first = render_reverse(&source, &settings("palette_grid")).expect("first");
    let repeat = render_reverse(&source, &settings("palette_grid")).expect("repeat");
    let mut changed_settings = settings("palette_grid");
    changed_settings.seed = Some("different-seed".to_string());
    let changed = render_reverse(&source, &changed_settings).expect("changed seed");

    assert_eq!(first.png, repeat.png);
    assert_eq!(first.manifest.palette, repeat.manifest.palette);
    assert_eq!(first.manifest.palette, changed.manifest.palette);
    assert_ne!(first.png, changed.png);
    assert_eq!(
        first
            .manifest
            .artifacts
            .palette_grid
            .as_ref()
            .unwrap()
            .width,
        12
    );
    assert_eq!(
        first
            .manifest
            .artifacts
            .palette_grid
            .as_ref()
            .unwrap()
            .height,
        10
    );
}

#[test]
fn renderer_registry_exposes_only_phase_four_visual_modes_and_legacy_negative() {
    let modes = robby_compiler::render::render_module_names();
    assert!(modes.contains(&"quantised_obverse"));
    assert!(modes.contains(&"palette_grid"));
    assert!(modes.contains(&"observability_sheet"));
}

#[test]
fn observability_sheet_is_an_instrument_plate_not_the_source_scene() {
    let source = bmp(8, 6);
    let first = render_reverse(&source, &settings("observability_sheet")).expect("sheet");
    let repeat = render_reverse(&source, &settings("observability_sheet")).expect("repeat");
    let quantised = render_reverse(&source, &settings("quantised_obverse")).expect("quantised");

    assert_eq!(first.png, repeat.png);
    assert_eq!(first.manifest.render_module, "observability_sheet");
    assert_eq!(first.manifest.palette_method, "median_cut");
    assert!(!first.manifest.colour_swatches.is_empty());
    assert_eq!(
        u32::from_be_bytes(first.png[16..20].try_into().unwrap()),
        1024
    );
    assert_eq!(
        u32::from_be_bytes(first.png[20..24].try_into().unwrap()),
        768
    );
    assert_ne!(first.png, quantised.png);
    assert_ne!(
        u32::from_be_bytes(quantised.png[16..20].try_into().unwrap()),
        1024
    );
    assert_eq!(
        first
            .manifest
            .artifacts
            .observability_sheet
            .as_ref()
            .unwrap()
            .sha256,
        first.manifest.output_sha256
    );
    assert!(first.manifest.artifacts.quantised_obverse.is_none());
}

#[test]
fn changing_palette_count_changes_recipe_and_output_reproducibly() {
    let source = bmp(16, 12);
    let mut eight = settings("quantised_obverse");
    eight.k = 8;
    let mut twelve = settings("quantised_obverse");
    twelve.k = 12;
    let first = render_reverse(&source, &eight).expect("k=8");
    let second = render_reverse(&source, &twelve).expect("k=12");
    let second_again = render_reverse(&source, &twelve).expect("k=12 repeat");
    assert_eq!(first.manifest.palette_parameters.requested_colours, 8);
    assert_eq!(second.manifest.palette_parameters.requested_colours, 12);
    assert_ne!(
        first.manifest.script_settings_sha256,
        second.manifest.script_settings_sha256
    );
    assert_eq!(second.png, second_again.png);
    assert_eq!(
        second
            .manifest
            .artifacts
            .quantised_obverse
            .as_ref()
            .unwrap()
            .sha256,
        second.manifest.output_sha256
    );
}

#[test]
fn median_cut_stops_when_boxes_are_uniform() {
    let source = bmp(8, 8);
    let mut settings = settings("quantised_obverse");
    settings.k = 8;
    let result = render_reverse(&source, &settings).expect("uniform boxes");
    let unique: std::collections::BTreeSet<_> = result
        .manifest
        .palette
        .iter()
        .map(|entry| entry.rgb)
        .collect();
    assert_eq!(unique.len(), result.manifest.palette.len());
    assert!(result.manifest.palette.len() <= 8);
    assert_eq!(unique.len(), 4);
}
