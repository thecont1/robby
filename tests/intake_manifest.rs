use std::io::Cursor;

use image::{DynamicImage, ImageFormat, Rgb, RgbImage};
use robby_compiler::intake::{inspect_image, C2paState, EvidenceClass, Visibility};

fn tiny_png() -> Vec<u8> {
    // A deterministic 2x1 RGB PNG generated from fixed, non-sensitive pixels.
    // Encoding in-test guarantees a valid fixture without importing user metadata.
    let mut image = RgbImage::new(2, 1);
    image.put_pixel(0, 0, Rgb([16, 32, 48]));
    image.put_pixel(1, 0, Rgb([200, 180, 160]));
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(image)
        .write_to(&mut bytes, ImageFormat::Png)
        .expect("encode fixture");
    bytes.into_inner()
}

fn tiny_jpeg() -> Vec<u8> {
    let image = RgbImage::from_pixel(1, 1, Rgb([96, 112, 128]));
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgb8(image)
        .write_to(&mut bytes, ImageFormat::Jpeg)
        .expect("encode JPEG fixture");
    bytes.into_inner()
}

#[test]
fn repeated_intake_has_stable_source_and_pixel_hashes() {
    let bytes = tiny_png();
    let first = inspect_image("fixture.png", &bytes).expect("fixture intake");
    let second = inspect_image("fixture.png", &bytes).expect("fixture intake");

    assert_eq!(first.obverse.byte_sha256, second.obverse.byte_sha256);
    assert_eq!(first.obverse.pixel_sha256, second.obverse.pixel_sha256);
    assert_eq!(first.obverse.byte_size, bytes.len() as u64);
    assert_eq!((first.obverse.width, first.obverse.height), (2, 1));
}

#[test]
fn metadata_free_image_is_compilable_and_marks_evidence_unavailable() {
    let manifest = inspect_image("fixture.png", &tiny_png()).expect("metadata-free intake");

    assert_eq!(
        manifest.evidence.exif.classification,
        EvidenceClass::Unavailable
    );
    assert_eq!(
        manifest.evidence.iptc.classification,
        EvidenceClass::Unavailable
    );
    assert_eq!(
        manifest.evidence.xmp.classification,
        EvidenceClass::Unavailable
    );
    assert_eq!(manifest.evidence.gps.visibility, Visibility::Private);
    assert_eq!(
        manifest.evidence.c2pa.value.as_ref().unwrap().state,
        C2paState::Absent
    );
}

#[test]
fn public_sanitizer_redacts_gps_and_identifying_fields() {
    let manifest = inspect_image("fixture.png", &tiny_png()).expect("fixture intake");
    let public = manifest.sanitize_public();

    assert_eq!(public.evidence.gps.visibility, Visibility::Redacted);
    assert!(public.evidence.gps.value.is_none());
    assert_eq!(public.evidence.exif.visibility, Visibility::Redacted);
    assert!(public.evidence.exif.value.is_none());
}

#[test]
fn c2pa_result_is_scoped_validation_evidence() {
    let manifest = inspect_image("fixture.png", &tiny_png()).expect("fixture intake");
    let c2pa = manifest
        .evidence
        .c2pa
        .value
        .expect("normalized C2PA result");

    assert_eq!(c2pa.state, C2paState::Absent);
    assert!(c2pa.validation_method.is_some());
    assert_eq!(
        manifest.evidence.c2pa.classification,
        EvidenceClass::Unavailable
    );
}

#[test]
fn manifest_contains_typed_robby_object_foundation() {
    let manifest = inspect_image("fixture.png", &tiny_png()).expect("fixture intake");
    let object = manifest.into_robby_object();

    assert_eq!(object.schema_version, "0.2");
    assert_eq!(object.obverse.mime_type, "image/png");
    assert_eq!(object.obverse.orientation, None);
}

/// Splice a real APP1/Exif segment carrying `tiff` into a JPEG right after SOI.
fn jpeg_with_app1_exif(tiff: &[u8]) -> Vec<u8> {
    let base = tiny_jpeg();
    let mut payload = b"Exif\0\0".to_vec();
    payload.extend_from_slice(tiff);
    let length = (payload.len() + 2) as u16;
    let mut out = Vec::new();
    out.extend_from_slice(&base[..2]); // SOI
    out.extend_from_slice(&[0xFF, 0xE1]);
    out.extend_from_slice(&length.to_be_bytes());
    out.extend_from_slice(&payload);
    out.extend_from_slice(&base[2..]);
    out
}

/// Splice a real `eXIf` chunk carrying `tiff` into a PNG after IHDR.
fn png_with_exif_chunk(tiff: &[u8]) -> Vec<u8> {
    let base = tiny_png();
    // Signature (8) + IHDR length/type/payload(13)/CRC = 8 + 4 + 4 + 13 + 4.
    let after_ihdr = 8 + 4 + 4 + 13 + 4;
    let mut out = Vec::new();
    out.extend_from_slice(&base[..after_ihdr]);
    out.extend_from_slice(&(tiff.len() as u32).to_be_bytes());
    out.extend_from_slice(b"eXIf");
    out.extend_from_slice(tiff);
    let mut crc_input = b"eXIf".to_vec();
    crc_input.extend_from_slice(tiff);
    out.extend_from_slice(&png_crc32(&crc_input).to_be_bytes());
    out.extend_from_slice(&base[after_ihdr..]);
    out
}

fn png_crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for byte in bytes {
        crc ^= *byte as u32;
        for _ in 0..8 {
            crc = if crc & 1 != 0 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
        }
    }
    !crc
}

/// A minimal little-endian TIFF header declaring Orientation = 6.
const ORIENTATION_6_TIFF: [u8; 26] = [
    b'I', b'I', 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
];

#[test]
fn malformed_and_unsupported_metadata_are_localized_states() {
    // A real APP1/Exif segment whose TIFF payload is junk is Corrupt.
    let corrupt = jpeg_with_app1_exif(b"not-a-tiff");
    let corrupt_manifest =
        inspect_image("corrupt.jpg", &corrupt).expect("corrupt metadata is non-fatal");
    assert_eq!(
        corrupt_manifest.evidence.exif.state,
        robby_compiler::intake::ExtractionState::Corrupt
    );
    assert!(corrupt_manifest.evidence.exif.value.is_none());

    // A real PNG eXIf chunk is parsed but not a supported metadata surface.
    let unsupported = png_with_exif_chunk(&ORIENTATION_6_TIFF);
    let unsupported_manifest = inspect_image("png-with-exif.png", &unsupported)
        .expect("unsupported metadata is non-fatal");
    assert_eq!(
        unsupported_manifest.evidence.exif.state,
        robby_compiler::intake::ExtractionState::Unsupported
    );
    assert_eq!(unsupported_manifest.obverse.orientation, Some(6));
}

#[test]
fn exif_bytes_outside_a_metadata_segment_are_not_treated_as_metadata() {
    // Trailing "Exif\0\0" garbage appended after the image is not a metadata
    // segment: scanning arbitrary file bytes would misread pixel data too.
    let mut trailing = tiny_jpeg();
    trailing.extend_from_slice(&[b'E', b'x', b'i', b'f', 0, 0]);
    trailing.extend_from_slice(&ORIENTATION_6_TIFF);
    let manifest = inspect_image("trailing.jpg", &trailing).expect("intake succeeds");
    assert_eq!(
        manifest.evidence.exif.state,
        robby_compiler::intake::ExtractionState::Absent
    );
    assert_eq!(manifest.obverse.orientation, None);
}

#[test]
fn malformed_tiff_orientation_type_is_corrupt_and_does_not_reorient() {
    // Orientation tag present, but type LONG (4) instead of SHORT (3).
    let tiff: [u8; 26] = [
        b'I', b'I', 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 4, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ];
    let jpeg = jpeg_with_app1_exif(&tiff);
    let manifest = inspect_image("bad-orientation.jpg", &jpeg).expect("intake succeeds");
    assert_eq!(
        manifest.evidence.exif.state,
        robby_compiler::intake::ExtractionState::Corrupt
    );
    assert_eq!(manifest.obverse.orientation, None);
}

#[test]
fn public_manifest_does_not_retain_the_submitted_filename() {
    let manifest = inspect_image("client-name-location.jpg", &tiny_jpeg()).expect("intake");
    let public = manifest.sanitize_public();
    assert_eq!(manifest.obverse.original_name, "client-name-location.jpg");
    assert!(!public
        .obverse
        .original_name
        .contains("client-name-location"));
    // Deterministic logical identifier, derived from the content digest.
    assert!(public.obverse.original_name.starts_with("source-"));
    assert_eq!(
        public.obverse.original_name,
        manifest.sanitize_public().obverse.original_name
    );
}
