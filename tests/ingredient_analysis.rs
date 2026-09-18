use robby_compiler::analyze_ingredients_json;
use serde_json::Value;

fn bmp(width: u32, height: u32) -> Vec<u8> {
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
            let value = (x * 17 + y * 31) as u8;
            out[offset..offset + 3].copy_from_slice(&[
                value,
                value.wrapping_add(40),
                value.wrapping_add(80),
            ]);
        }
    }
    out
}

#[test]
fn ingredient_analysis_is_bounded_and_repeatable() {
    let source = bmp(64, 48);
    let first: Value =
        serde_json::from_str(&analyze_ingredients_json(&source, 8).expect("analysis"))
            .expect("valid analysis JSON");
    let second: Value =
        serde_json::from_str(&analyze_ingredients_json(&source, 8).expect("analysis"))
            .expect("valid analysis JSON");
    assert_eq!(first, second);
    assert_eq!(first["schema_version"], "robby-ingredients-v1");
    assert_eq!(first["structure"]["grid_size"], 8);
    assert_eq!(
        first["structure"]["spatial_cells"]
            .as_array()
            .unwrap()
            .len(),
        64
    );
    assert_eq!(
        first["structure"]["edge_field"].as_array().unwrap().len(),
        64
    );
    assert_eq!(
        first["identity"]["perceptual_hash"].as_str().unwrap().len(),
        16
    );
    assert_eq!(first["palette"]["entries"].as_array().unwrap().len(), 8);
}

#[test]
fn changing_analysis_k_changes_palette_record_but_not_source_identity() {
    let source = bmp(64, 48);
    let eight: Value =
        serde_json::from_str(&analyze_ingredients_json(&source, 8).expect("analysis"))
            .expect("valid analysis JSON");
    let sixteen: Value =
        serde_json::from_str(&analyze_ingredients_json(&source, 16).expect("analysis"))
            .expect("valid analysis JSON");
    assert_eq!(
        eight["source"]["byte_sha256"],
        sixteen["source"]["byte_sha256"]
    );
    assert_ne!(
        eight["palette"]["index_map_sha256"],
        sixteen["palette"]["index_map_sha256"]
    );
    assert_eq!(sixteen["palette"]["entries"].as_array().unwrap().len(), 16);
}
