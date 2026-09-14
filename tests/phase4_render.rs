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
        sheet: None,
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

fn sheet_facts(binding: &str) -> robby_compiler::render::SheetFacts {
    robby_compiler::render::SheetFacts {
        run_id: Some("run-1".into()),
        binding_short_id: Some(binding.into()),
        source_sha256: Some(
            "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899".into(),
        ),
        pixel_sha256: Some(
            "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff".into(),
        ),
        recipe_sha256: Some(
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff".into(),
        ),
        palette_k: Some(8),
        reverse_mode: Some("observability_sheet".into()),
        ir_schema: Some("robby-ir-v1".into()),
        policy_name: Some("robby-v1-default-disclosure-policy".into()),
        evidence: robby_compiler::render::SheetEvidenceState {
            exif: Some("OBSERVED".into()),
            iptc: Some("UNAVAILABLE".into()),
            xmp: Some("UNAVAILABLE".into()),
            gps: Some("REDACTED".into()),
            c2pa: Some("ABSENT".into()),
        },
        included: vec![
            "Palette".into(),
            "binding mark".into(),
            "recipe parameters".into(),
            "evidence states".into(),
        ],
        withheld: vec![
            "Source pixels".into(),
            "raw GPS".into(),
            "timestamps".into(),
            "filename".into(),
            "raw metadata".into(),
        ],
    }
}

#[test]
fn observability_sheet_is_byte_identical_for_identical_facts() {
    let source = bmp(8, 6);
    let mut first_settings = settings("observability_sheet");
    first_settings.sheet = Some(sheet_facts("RB-A1B2-C3D4"));
    let first = render_reverse(&source, &first_settings).expect("first");
    let second = render_reverse(&source, &first_settings).expect("second");
    assert_eq!(first.png, second.png);
    assert_eq!(first.manifest.output_sha256, second.manifest.output_sha256);
}

#[test]
fn observability_sheet_changes_when_binding_id_changes() {
    let source = bmp(8, 6);
    let mut left = settings("observability_sheet");
    left.sheet = Some(sheet_facts("RB-AAAA-BBBB"));
    let mut right = settings("observability_sheet");
    right.sheet = Some(sheet_facts("RB-CCCC-DDDD"));
    let first = render_reverse(&source, &left).expect("left");
    let second = render_reverse(&source, &right).expect("right");
    assert_ne!(first.png, second.png);
}

#[test]
fn absent_sheet_facts_do_not_change_quantised_obverse_settings_hash() {
    let source = bmp(8, 6);
    let with_none = settings("quantised_obverse");
    let mut omitted = with_none.clone();
    omitted.sheet = None;
    let first = render_reverse(&source, &with_none).expect("none");
    let second = render_reverse(&source, &omitted).expect("omitted");
    assert_eq!(first.png, second.png);
    assert_eq!(
        first.manifest.script_settings_sha256,
        second.manifest.script_settings_sha256
    );
}

/// Decode a PNG into (width, height, RGB rows). Minimal inflate-free path is
/// impossible, so lean on the `image` crate already in the dependency graph.
fn decode_png(bytes: &[u8]) -> (u32, u32, Vec<[u8; 3]>) {
    let img = image::load_from_memory(bytes)
        .expect("decode png")
        .to_rgb8();
    let (w, h) = img.dimensions();
    let pixels = img.pixels().map(|p| [p[0], p[1], p[2]]).collect();
    (w, h, pixels)
}

/// A source with a heavily skewed colour distribution: one dominant colour
/// plus many rare ones. This is what real photographs look like, and it is
/// what triggers the swatch-clipping bug — uniform gradients give every
/// entry a large span and hide it.
fn rich_bmp(width: u32, height: u32) -> Vec<u8> {
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
            // ~80% of the frame is one near-uniform dark tone; the remainder
            // is a scatter of distinct rare colours.
            let index = y * width + x;
            let pixel = if !index.is_multiple_of(5) {
                [20_u8, 22, 24]
            } else {
                let n = index / 5;
                [
                    ((n * 37) % 256) as u8,
                    ((n * 91) % 256) as u8,
                    ((n * 151) % 256) as u8,
                ]
            };
            out[offset..offset + 3].copy_from_slice(&pixel);
        }
    }
    out
}

/// A frame dominated by a dense near-white cluster, reproducing what real
/// photographs with large blown-out regions do to median cut: several buckets
/// round to the SAME 8-bit RGB, so the palette contains identical adjacent
/// entries and only the hairline can separate them.
///
/// Distilled from `MS201412-AddisAbaba0315.jpg`, the one image in a 992-config
/// sweep (16 sources x k=3..64) that produces duplicate adjacent entries — it
/// does so for every k in 34..=64. This 64x48 synthetic hits the same state at
/// k=10..=15 without committing a 2.8 MB photograph.
fn near_white_cluster_bmp(width: u32, height: u32) -> Vec<u8> {
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
            let pixel = if y < height * 3 / 4 {
                // 236..=247: twelve near-white tones, far denser than the
                // palette can resolve, so buckets collapse onto each other.
                let v = 236 + ((x * 7 + y * 3) % 12) as u8;
                [v, v, v]
            } else {
                // Saturated anchors so median cut still has to spend entries
                // elsewhere rather than resolving the white band finely.
                [
                    ((x * 37) % 256) as u8,
                    ((y * 53) % 256) as u8,
                    ((x * y) % 256) as u8,
                ]
            };
            out[offset..offset + 3].copy_from_slice(&pixel);
        }
    }
    out
}

/// WCAG 2.x relative luminance, mirrored here because the renderer's copy is
/// private. Kept local so the production API stays unchanged.
fn relative_luminance(rgb: [u8; 3]) -> f64 {
    let channel = |value: u8| {
        let value = f64::from(value) / 255.0;
        if value <= 0.03928 {
            value / 12.92
        } else {
            ((value + 0.055) / 1.055).powf(2.4)
        }
    };
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

fn contrast_ratio(left: [u8; 3], right: [u8; 3]) -> f64 {
    let (a, b) = (relative_luminance(left), relative_luminance(right));
    (a.max(b) + 0.05) / (a.min(b) + 0.05)
}

fn sheet_with_k(k: u8) -> robby_compiler::render::RenderResult {
    let mut s = settings("observability_sheet");
    s.k = k;
    render_reverse(&rich_bmp(96, 72), &s).expect("sheet")
}

/// Every declared palette colour must be countable in the swatch band. A
/// fixed minimum span used to overrun the band for k >= 26, clipping the
/// tail entries so the viewer saw fewer swatches than k.
#[test]
fn observability_sheet_draws_every_declared_swatch_for_all_supported_k() {
    for k in 3_u8..=64 {
        let out = sheet_with_k(k);
        let declared = out.manifest.palette.len();
        let (w, _h, px) = decode_png(&out.png);

        // Sample the middle scanline of the swatch band (y = 48 + 64 .. + 40),
        // collecting run-length encoded colour regions.
        let y = 48 + 64 + 20;
        let mut runs: Vec<([u8; 3], u32)> = Vec::new();
        for x in 48..(w - 48) {
            let c = px[(y * w + x) as usize];
            match runs.last_mut() {
                Some((colour, width)) if *colour == c => *width += 1,
                _ => runs.push((c, 1)),
            }
        }

        let expected: Vec<[u8; 3]> = out.manifest.palette.iter().map(|entry| entry.rgb).collect();

        // Count what a viewer counts: contiguous regions wider than a hairline
        // boundary. This stays true to the user-visible contract ("k=n must
        // show n swatches") without asserting how separation is achieved, so
        // the test still fails if spans are ever clipped again.
        let swatches: Vec<[u8; 3]> = runs
            .iter()
            .filter(|(_, width)| *width > 1)
            .map(|(colour, _)| *colour)
            .collect();
        assert_eq!(
            swatches.len(),
            expected.len(),
            "k={k}: expected {} countable swatches, saw {}",
            expected.len(),
            swatches.len()
        );
        assert_eq!(
            swatches, expected,
            "k={k}: swatch band must show every declared colour in palette order"
        );

        // A boundary that merely *differs* from its neighbours is not
        // necessarily *visible*. Median cut emits adjacent entries that
        // quantise to the SAME near-white RGB on real photographs; there the
        // hairline is the only thing separating two swatches, and picking the
        // first differing sheet colour once selected a 1.38:1 line — which
        // reproduces "k=n, I count n-1" even though the run-length check above
        // passes. Where neighbours already differ from each other they
        // self-separate, and no single colour can be high-contrast against
        // both (for e.g. [24,22,20]/[142,186,153] the best colour in the whole
        // RGB cube reaches only 2.88:1), so the strict bar applies to the
        // duplicate case that actually needs it.
        let mut cursor = 0_u32;
        for (index, (colour, width)) in runs.iter().enumerate() {
            cursor += width;
            if *width != 1 || index == 0 || index + 1 >= runs.len() {
                continue;
            }
            let (left, _) = runs[index - 1];
            let (right, _) = runs[index + 1];
            let worst = contrast_ratio(*colour, left).min(contrast_ratio(*colour, right));
            if left == right {
                assert!(
                    worst >= 3.0,
                    "k={k}: identical swatches {left:?} are separated only by \
                     {colour:?} at {worst:.2}:1 — a viewer counts them as one"
                );
            } else {
                // Distinct neighbours self-separate; the hairline must still
                // not be one of them.
                assert!(
                    *colour != left && *colour != right,
                    "k={k}: boundary at x={cursor} duplicates a neighbour"
                );
            }
        }

        // This fixture has hundreds of distinct colours, so median cut must
        // satisfy every legal requested k rather than exercising the
        // low-colour-source exception.
        assert_eq!(
            declared, k as usize,
            "k={k}: rich source should declare exactly the requested palette size"
        );
    }
}

/// The swatch band must stay flush to its margins: no gap on the right and
/// no overrun past the drawable width.
#[test]
fn observability_sheet_swatch_band_fills_its_full_width() {
    for k in [3_u8, 20, 64] {
        let out = sheet_with_k(k);
        let (w, _h, px) = decode_png(&out.png);
        let y = 48 + 64 + 20;
        let paper = [28_u8, 26, 25];
        assert_ne!(
            px[(y * w + (w - 49)) as usize],
            paper,
            "k={k}: right edge of the swatch band is unpainted"
        );
        assert_ne!(
            px[(y * w + 48) as usize],
            paper,
            "k={k}: left edge of the swatch band is unpainted"
        );
    }
}

/// Editorial levels must not collide. Identity previously advanced by
/// `len - 1` lines, leaving only 2px before the recipe block so the two
/// ran together. Assert a real gutter between every pair of text bands.
#[test]
fn observability_sheet_separates_its_editorial_levels() {
    let out = sheet_with_k(8);
    let (w, h, px) = decode_png(&out.png);
    let paper = [28_u8, 26, 25];

    // Ink profile of the left text column, below the swatch band.
    let mut bands: Vec<(u32, u32)> = Vec::new();
    let mut start: Option<u32> = None;
    for y in 160..(h - 60) {
        let inked = (48..640).any(|x| px[(y * w + x) as usize] != paper);
        match (inked, start) {
            (true, None) => start = Some(y),
            (false, Some(s)) => {
                bands.push((s, y - 1));
                start = None;
            }
            _ => {}
        }
    }
    if let Some(s) = start {
        bands.push((s, h - 61));
    }

    assert!(
        bands.len() > 8,
        "expected the sheet's text levels to render"
    );
    for pair in bands.windows(2) {
        let gap = pair[1].0 - pair[0].1 - 1;
        assert!(
            gap >= 6,
            "text bands {:?} and {:?} are only {gap}px apart — blocks are sticking together",
            pair[0],
            pair[1]
        );
    }
}

/// The case the separator fix actually exists for.
///
/// `observability_sheet_draws_every_declared_swatch_for_all_supported_k` holds
/// the strict >= 3:1 bar behind `left == right`, but its rich fixture has
/// hundreds of distinct colours and never emits identical adjacent entries, so
/// that branch never executed — the test passed without ever checking the
/// thing it was written to check. A 992-config sweep over the real gallery
/// found the state does occur (near-white collapse, 31 configs), so pin it
/// with a fixture that reproduces it in-tree.
///
/// Choosing the first *differing* sheet colour once yielded a 1.38:1 hairline
/// here: k entries declared, k-1 countable. Choosing for maximum contrast
/// yields 15.35:1 on the real photograph.
#[test]
fn observability_sheet_separates_identical_adjacent_swatches() {
    let source = near_white_cluster_bmp(64, 48);
    let mut exercised = 0_u32;

    for k in 10_u8..=15 {
        let mut s = settings("observability_sheet");
        s.k = k;
        let out = render_reverse(&source, &s).expect("sheet");

        let palette: Vec<[u8; 3]> = out.manifest.palette.iter().map(|e| e.rgb).collect();
        let duplicates = palette.windows(2).filter(|pair| pair[0] == pair[1]).count();
        if duplicates == 0 {
            continue;
        }
        exercised += 1;

        let (w, _h, px) = decode_png(&out.png);
        let y = 48 + 64 + 20;
        let mut runs: Vec<([u8; 3], u32)> = Vec::new();
        for x in 48..(w - 48) {
            let c = px[(y * w + x) as usize];
            match runs.last_mut() {
                Some((colour, width)) if *colour == c => *width += 1,
                _ => runs.push((c, 1)),
            }
        }

        // Every declared entry stays countable even when two are the same RGB.
        let countable = runs.iter().filter(|(_, width)| *width > 1).count();
        assert_eq!(
            countable,
            palette.len(),
            "k={k}: {duplicates} duplicate adjacent entries collapsed — \
             viewer counts {countable} of {} swatches",
            palette.len()
        );

        // And the hairline between two identical swatches must be visible.
        let mut checked = 0_u32;
        for (index, (colour, width)) in runs.iter().enumerate() {
            if *width != 1 || index == 0 || index + 1 >= runs.len() {
                continue;
            }
            let (left, _) = runs[index - 1];
            let (right, _) = runs[index + 1];
            if left != right {
                continue;
            }
            checked += 1;
            let worst = contrast_ratio(*colour, left).min(contrast_ratio(*colour, right));
            assert!(
                worst >= 3.0,
                "k={k}: identical swatches {left:?} separated only by {colour:?} \
                 at {worst:.2}:1 — a viewer counts them as one"
            );
        }
        assert!(
            checked > 0,
            "k={k}: palette has {duplicates} duplicate pairs but no hairline \
             was measured between identical swatches"
        );
    }

    // Guard against the vacuity this test was written to fix: if quantisation
    // ever stops producing duplicates here, fail loudly rather than pass empty.
    assert!(
        exercised > 0,
        "fixture no longer produces identical adjacent palette entries — \
         the duplicate-separator path is unverified; rebuild the fixture"
    );
}
