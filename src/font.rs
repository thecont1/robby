//! A minimal deterministic 5x7 pixel font for reverse-side text.
//!
//! The observability sheet must render readable text without external font
//! dependencies (wasm-safe, no system fonts). Glyphs are uppercase-only;
//! callers normalize text with `sheet_text`. Every unknown character renders
//! as a space, so no input can panic or corrupt layout.

const GLYPHS: &[(char, [&str; 7])] = &[
    (
        'A',
        [
            "01110", "10001", "10001", "11111", "10001", "10001", "10001",
        ],
    ),
    (
        'B',
        [
            "11110", "10001", "10001", "11110", "10001", "10001", "11110",
        ],
    ),
    (
        'C',
        [
            "01110", "10001", "10000", "10000", "10000", "10001", "01110",
        ],
    ),
    (
        'D',
        [
            "11100", "10010", "10001", "10001", "10001", "10010", "11100",
        ],
    ),
    (
        'E',
        [
            "11111", "10000", "10000", "11110", "10000", "10000", "11111",
        ],
    ),
    (
        'F',
        [
            "11111", "10000", "10000", "11110", "10000", "10000", "10000",
        ],
    ),
    (
        'G',
        [
            "01110", "10001", "10000", "10111", "10001", "10001", "01111",
        ],
    ),
    (
        'H',
        [
            "10001", "10001", "10001", "11111", "10001", "10001", "10001",
        ],
    ),
    (
        'I',
        [
            "01110", "00100", "00100", "00100", "00100", "00100", "01110",
        ],
    ),
    (
        'J',
        [
            "00111", "00010", "00010", "00010", "00010", "10010", "01100",
        ],
    ),
    (
        'K',
        [
            "10001", "10010", "10100", "11000", "10100", "10010", "10001",
        ],
    ),
    (
        'L',
        [
            "10000", "10000", "10000", "10000", "10000", "10000", "11111",
        ],
    ),
    (
        'M',
        [
            "10001", "11011", "10101", "10101", "10001", "10001", "10001",
        ],
    ),
    (
        'N',
        [
            "10001", "10001", "11001", "10101", "10011", "10001", "10001",
        ],
    ),
    (
        'O',
        [
            "01110", "10001", "10001", "10001", "10001", "10001", "01110",
        ],
    ),
    (
        'P',
        [
            "11110", "10001", "10001", "11110", "10000", "10000", "10000",
        ],
    ),
    (
        'Q',
        [
            "01110", "10001", "10001", "10001", "10101", "10010", "01101",
        ],
    ),
    (
        'R',
        [
            "11110", "10001", "10001", "11110", "10100", "10010", "10001",
        ],
    ),
    (
        'S',
        [
            "01111", "10000", "10000", "01110", "00001", "00001", "11110",
        ],
    ),
    (
        'T',
        [
            "11111", "00100", "00100", "00100", "00100", "00100", "00100",
        ],
    ),
    (
        'U',
        [
            "10001", "10001", "10001", "10001", "10001", "10001", "01110",
        ],
    ),
    (
        'V',
        [
            "10001", "10001", "10001", "10001", "10001", "01010", "00100",
        ],
    ),
    (
        'W',
        [
            "10001", "10001", "10001", "10101", "10101", "11011", "10001",
        ],
    ),
    (
        'X',
        [
            "10001", "10001", "01010", "00100", "01010", "10001", "10001",
        ],
    ),
    (
        'Y',
        [
            "10001", "10001", "01010", "00100", "00100", "00100", "00100",
        ],
    ),
    (
        'Z',
        [
            "11111", "00001", "00010", "00100", "01000", "10000", "11111",
        ],
    ),
    (
        '0',
        [
            "01110", "10001", "10011", "10101", "11001", "10001", "01110",
        ],
    ),
    (
        '1',
        [
            "00100", "01100", "00100", "00100", "00100", "00100", "01110",
        ],
    ),
    (
        '2',
        [
            "01110", "10001", "00001", "00010", "00100", "01000", "11111",
        ],
    ),
    (
        '3',
        [
            "11110", "00001", "00001", "01110", "00001", "00001", "11110",
        ],
    ),
    (
        '4',
        [
            "00010", "00110", "01010", "10010", "11111", "00010", "00010",
        ],
    ),
    (
        '5',
        [
            "11111", "10000", "11110", "00001", "00001", "10001", "01110",
        ],
    ),
    (
        '6',
        [
            "00110", "01000", "10000", "11110", "10001", "10001", "01110",
        ],
    ),
    (
        '7',
        [
            "11111", "00001", "00010", "00100", "01000", "01000", "01000",
        ],
    ),
    (
        '8',
        [
            "01110", "10001", "10001", "01110", "10001", "10001", "01110",
        ],
    ),
    (
        '9',
        [
            "01110", "10001", "10001", "01111", "00001", "00010", "01100",
        ],
    ),
    (
        ' ',
        [
            "00000", "00000", "00000", "00000", "00000", "00000", "00000",
        ],
    ),
    (
        ':',
        [
            "00000", "00100", "00100", "00000", "00100", "00100", "00000",
        ],
    ),
    (
        '/',
        [
            "00001", "00010", "00010", "00100", "01000", "01000", "10000",
        ],
    ),
    (
        '-',
        [
            "00000", "00000", "00000", "11111", "00000", "00000", "00000",
        ],
    ),
    (
        '.',
        [
            "00000", "00000", "00000", "00000", "00000", "00000", "00100",
        ],
    ),
    (
        '·',
        [
            "00000", "00000", "00000", "00100", "00000", "00000", "00000",
        ],
    ),
    (
        '…',
        [
            "00000", "00000", "00000", "00000", "00000", "00000", "10101",
        ],
    ),
    (
        '_',
        [
            "00000", "00000", "00000", "00000", "00000", "00000", "11111",
        ],
    ),
];

const GLYPH_WIDTH: u32 = 5;
#[cfg(test)]
const GLYPH_HEIGHT: u32 = 7;
const TRACKING: u32 = 1;

/// Normalize arbitrary text into the sheet's uppercase charset.
pub fn sheet_text(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            let upper = character.to_ascii_uppercase();
            if upper.is_ascii_uppercase() || upper.is_ascii_digit() {
                upper
            } else {
                match character {
                    ':' | '/' | '-' | '.' | '·' | '…' | '_' | ' ' => character,
                    _ => ' ',
                }
            }
        })
        .collect()
}

fn glyph(character: char) -> Option<&'static [&'static str; 7]> {
    GLYPHS
        .iter()
        .find(|(known, _)| *known == character)
        .map(|(_, rows)| rows)
}

/// Width in pixels of `text` rendered at `scale`.
pub fn text_width(text: &str, scale: u32) -> u32 {
    if text.is_empty() {
        return 0;
    }
    let units = text.chars().count() as u32;
    units * (GLYPH_WIDTH + TRACKING) * scale - TRACKING * scale
}

/// Draw `text` at (`x`, `y`) with integer `scale` (1 = 5x7 px per glyph).
/// Unknown characters render as spaces; drawing is clipped to the image.
pub fn draw_text(
    image: &mut image::RgbImage,
    x: u32,
    y: u32,
    text: &str,
    scale: u32,
    color: image::Rgb<u8>,
) {
    let scale = scale.max(1);
    let mut cursor = x;
    for character in sheet_text(text).chars() {
        let rows = glyph(character).copied().unwrap_or([
            "00000", "00000", "00000", "00000", "00000", "00000", "00000",
        ]);
        for (row_index, row) in rows.iter().enumerate() {
            for (column_index, cell) in row.chars().enumerate() {
                if cell != '1' {
                    continue;
                }
                let cell_x = cursor + column_index as u32 * scale;
                let cell_y = y + row_index as u32 * scale;
                for dy in 0..scale {
                    for dx in 0..scale {
                        let px = cell_x + dx;
                        let py = cell_y + dy;
                        if px < image.width() && py < image.height() {
                            image.put_pixel(px, py, color);
                        }
                    }
                }
            }
        }
        cursor += (GLYPH_WIDTH + TRACKING) * scale;
    }
}

/// Truncate a hex digest for display: `E1D2…8899`.
pub fn truncated_digest(value: &str) -> String {
    let hex: String = value
        .chars()
        .filter(|character| character.is_ascii_hexdigit())
        .take(64)
        .collect::<String>()
        .to_uppercase();
    if hex.len() < 8 {
        return hex;
    }
    format!("{}…{}", &hex[0..4], &hex[hex.len() - 4..])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_lowercase_and_unknowns() {
        assert_eq!(
            sheet_text("reverse: observability_sheet"),
            "REVERSE: OBSERVABILITY_SHEET"
        );
        assert_eq!(sheet_text("a(b)c"), "A B C");
    }

    #[test]
    fn truncates_hex_digests() {
        assert_eq!(
            truncated_digest("e1d2a73b00112233445566778899aabbccddeeff"),
            "E1D2…EEFF"
        );
        assert_eq!(truncated_digest("abc"), "ABC");
    }

    #[test]
    fn ink_width_is_advance_width_minus_trailing_blank_columns() {
        use image::{ImageBuffer, Rgb};
        let text = "ORIO";
        let scale = 2;
        let advance = text_width(text, scale);
        let mut image = ImageBuffer::new(advance, GLYPH_HEIGHT * scale);
        draw_text(&mut image, 0, 0, text, scale, Rgb([255, 255, 255]));
        // The 'O' glyph inks column 4 in rows 1-5 ("10001"), so the rightmost
        // ink reaches the final advance column at row 2 — deterministic.
        let rightmost_ink = (0..advance)
            .rev()
            .find(|x| image.get_pixel(*x, 2).0[0] == 255)
            .expect("ink present");
        assert!(rightmost_ink < advance);
        assert_eq!(rightmost_ink, 45);
    }
}
