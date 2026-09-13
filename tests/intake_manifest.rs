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

#[test]
fn malformed_and_unsupported_metadata_are_localized_states() {
    let mut corrupt = tiny_jpeg();
    corrupt.extend_from_slice(b"Exif\\0\\0not-a-tiff");
    let corrupt_manifest =
        inspect_image("corrupt.jpg", &corrupt).expect("corrupt metadata is non-fatal");
    assert_eq!(
        corrupt_manifest.evidence.exif.state,
        robby_compiler::intake::ExtractionState::Corrupt
    );
    assert!(corrupt_manifest.evidence.exif.value.is_none());

    let mut unsupported = tiny_jpeg();
    unsupported.extend_from_slice(b"Exif\\0\\0II*\\0\\x08\\0\\0\\0\\x01\\0\\x12\\x01\\x03\\0\\x01\\0\\0\\0\\x06\\0\\0\\0\\0\\0\\0\\0");
    let unsupported_manifest = inspect_image("jpeg-with-exif.jpg", &unsupported)
        .expect("unsupported metadata is non-fatal");
    assert_eq!(
        unsupported_manifest.evidence.exif.state,
        robby_compiler::intake::ExtractionState::Unsupported
    );
    assert_eq!(unsupported_manifest.obverse.orientation, Some(6));
}
