//! Deterministic image intake and privacy-aware ingredient manifests.
use std::collections::BTreeMap;
use std::io::Cursor;

use image::{DynamicImage, ImageFormat, ImageReader};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::{CompileResult, CompilerError};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EvidenceClass {
    Observed,
    Verified,
    Measured,
    Derived,
    Declared,
    Redacted,
    Unavailable,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Visibility {
    Private,
    Public,
    Redacted,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExtractionState {
    Present,
    Absent,
    Corrupt,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceField<T> {
    pub classification: EvidenceClass,
    pub value: Option<T>,
    pub visibility: Visibility,
    pub source: Option<String>,
    pub state: ExtractionState,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum C2paState {
    Present,
    Absent,
    Invalid,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct C2paEvidence {
    pub state: C2paState,
    pub validation_method: Option<String>,
    pub claim_generator: Option<String>,
    pub selected_evidence_digest: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Obverse {
    pub original_name: String,
    pub mime_type: String,
    pub byte_size: u64,
    pub byte_sha256: String,
    pub pixel_sha256: String,
    pub width: u32,
    pub height: u32,
    pub orientation: Option<u16>,
    pub colour_profile: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Evidence {
    pub exif: EvidenceField<BTreeMap<String, String>>,
    pub iptc: EvidenceField<BTreeMap<String, String>>,
    pub xmp: EvidenceField<BTreeMap<String, String>>,
    pub gps: EvidenceField<BTreeMap<String, f64>>,
    pub c2pa: EvidenceField<C2paEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IngredientManifest {
    pub schema_version: String,
    pub obverse: Obverse,
    pub evidence: Evidence,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RobbyObject {
    pub schema_version: String,
    pub object_id: String,
    pub compile_run_id: String,
    pub created_at: String,
    pub obverse: Obverse,
    pub evidence: Evidence,
}

const C2PA_METHOD: &str = "C2PA validation is scoped to embedded source credentials; Robby does not infer ownership or authorship";

pub fn inspect_image(original_name: &str, bytes: &[u8]) -> CompileResult<IngredientManifest> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| {
            CompilerError::plain(format!("Unable to identify image format: {error}"))
        })?;
    let format = reader
        .format()
        .ok_or_else(|| CompilerError::plain("Unsupported image format"))?;
    let decoded = reader
        .decode()
        .map_err(|error| CompilerError::plain(format!("Unable to decode image: {error}")))?;
    let (orientation, exif_state, exif_value) = extract_exif(bytes, format);
    let oriented = orient(decoded, orientation);
    let rgba = oriented.to_rgba8();
    let mut canonical = Vec::with_capacity(8 + rgba.as_raw().len());
    canonical.extend_from_slice(&rgba.width().to_be_bytes());
    canonical.extend_from_slice(&rgba.height().to_be_bytes());
    canonical.extend_from_slice(rgba.as_raw());
    let byte_sha256 = hex_digest(bytes);
    let pixel_sha256 = hex_digest(&canonical);
    let (iptc_state, iptc_value) = extract_marker_map(bytes, b"8BIM", b"IPTC");
    let (xmp_state, xmp_value) =
        extract_marker_map(bytes, b"http://ns.adobe.com/xap/1.0/", b"<x:xmpmeta");
    let c2pa = normalize_c2pa(bytes);
    let gps = gps_field(bytes, format);
    Ok(IngredientManifest {
        schema_version: "0.2".to_string(),
        obverse: Obverse {
            original_name: original_name.to_string(),
            mime_type: mime_type(format),
            byte_size: bytes.len() as u64,
            byte_sha256,
            pixel_sha256,
            width: rgba.width(),
            height: rgba.height(),
            orientation,
            colour_profile: detect_colour_profile(bytes),
        },
        evidence: Evidence {
            exif: field_from_state(exif_state, exif_value, "EXIF"),
            iptc: field_from_state(iptc_state, iptc_value, "IPTC"),
            xmp: field_from_state(xmp_state, xmp_value, "XMP"),
            gps,
            c2pa: EvidenceField {
                classification: if c2pa.state == C2paState::Present {
                    EvidenceClass::Verified
                } else {
                    EvidenceClass::Unavailable
                },
                value: Some(c2pa),
                visibility: Visibility::Private,
                source: Some("embedded source credential inspection".to_string()),
                state: if c2pa_state_present(bytes) {
                    ExtractionState::Present
                } else {
                    ExtractionState::Absent
                },
                note: Some(C2PA_METHOD.to_string()),
            },
        },
    })
}

/// A stable, non-sensitive stand-in for the submitted filename.
///
/// Derived from the content digest so it is deterministic and reproducible,
/// while carrying none of the original name's identifying content.
fn public_logical_name(obverse: &Obverse) -> String {
    let extension = match obverse.mime_type.as_str() {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        _ => "bin",
    };
    let short: String = obverse.byte_sha256.chars().take(12).collect();
    format!("source-{short}.{extension}")
}

impl IngredientManifest {
    pub fn sanitize_public(&self) -> Self {
        let mut public = self.clone();
        // The submitted filename is user-identifying (it routinely carries
        // names, locations and client references). The public manifest keeps
        // only a stable logical identifier derived from the content digest.
        public.obverse.original_name = public_logical_name(&self.obverse);
        public.evidence.gps = redact(public.evidence.gps, "GPS is private by default.");
        public.evidence.exif = redact(
            public.evidence.exif,
            "EXIF identifying fields are private by default.",
        );
        public.evidence.iptc = redact(
            public.evidence.iptc,
            "IPTC identifying fields are private by default.",
        );
        public.evidence.xmp = redact(
            public.evidence.xmp,
            "XMP identifying fields are private by default.",
        );
        public.evidence.c2pa.visibility = Visibility::Redacted;
        if let Some(value) = public.evidence.c2pa.value.as_mut() {
            value.claim_generator = None;
            value.selected_evidence_digest = None;
        }
        public
    }

    pub fn into_robby_object(self) -> RobbyObject {
        let object_id = self.obverse.byte_sha256.clone();
        RobbyObject {
            schema_version: self.schema_version,
            object_id,
            compile_run_id: String::new(),
            created_at: String::new(),
            obverse: self.obverse,
            evidence: self.evidence,
        }
    }
}

fn hex_digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn mime_type(format: ImageFormat) -> String {
    match format {
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::Png => "image/png",
        ImageFormat::Bmp => "image/bmp",
        _ => "application/octet-stream",
    }
    .to_string()
}

/// Apply the EXIF orientation so downstream pixels are canonical.
///
/// Shared with the renderer: intake and render must agree byte-for-byte on
/// what "the canonical pixels" are, or pixel_sha256 and the rendered
/// dimensions silently diverge for rotated sources.
pub fn orient(mut image: DynamicImage, orientation: Option<u16>) -> DynamicImage {
    if let Some(value) = orientation {
        image.apply_orientation(match value {
            2 => image::metadata::Orientation::FlipHorizontal,
            3 => image::metadata::Orientation::Rotate180,
            4 => image::metadata::Orientation::FlipVertical,
            5 => image::metadata::Orientation::Rotate90FlipH,
            6 => image::metadata::Orientation::Rotate90,
            7 => image::metadata::Orientation::Rotate270FlipH,
            8 => image::metadata::Orientation::Rotate270,
            _ => image::metadata::Orientation::NoTransforms,
        });
    }
    image
}

fn empty_field<T>(state: ExtractionState, note: &str) -> EvidenceField<T> {
    EvidenceField {
        classification: EvidenceClass::Unavailable,
        value: None,
        visibility: Visibility::Private,
        source: None,
        state,
        note: Some(note.to_string()),
    }
}
fn absent_field<T>(note: &str) -> EvidenceField<T> {
    empty_field(ExtractionState::Absent, note)
}

fn gps_field(bytes: &[u8], format: ImageFormat) -> EvidenceField<BTreeMap<String, f64>> {
    match gps_extraction_state(bytes, format) {
        ExtractionState::Present => empty_field(
            ExtractionState::Present,
            "GPS metadata block detected; coordinates remain private by default.",
        ),
        ExtractionState::Corrupt => empty_field(
            ExtractionState::Corrupt,
            "GPS metadata pointer was present but unreadable; coordinates remain private.",
        ),
        ExtractionState::Unsupported => empty_field(
            ExtractionState::Unsupported,
            "GPS encoding is unsupported; coordinates remain private.",
        ),
        ExtractionState::Absent => absent_field("No GPS metadata block was detected."),
    }
}

fn field_from_state(
    state: ExtractionState,
    value: Option<BTreeMap<String, String>>,
    name: &str,
) -> EvidenceField<BTreeMap<String, String>> {
    let class = if value.is_some() {
        EvidenceClass::Observed
    } else {
        EvidenceClass::Unavailable
    };
    EvidenceField {
        classification: class,
        value,
        visibility: Visibility::Private,
        source: Some(name.to_string()),
        state,
        note: Some(match state {
            ExtractionState::Absent => format!("No {name} block was present."),
            ExtractionState::Corrupt => format!("{name} block was present but unreadable."),
            ExtractionState::Unsupported => format!("{name} encoding is unsupported."),
            ExtractionState::Present => format!("{name} was observed in the source."),
        }),
    }
}
fn redact<T>(mut field: EvidenceField<T>, note: &str) -> EvidenceField<T> {
    field.value = None;
    field.visibility = Visibility::Redacted;
    field.classification = EvidenceClass::Redacted;
    field.note = Some(note.to_string());
    field
}

fn extract_marker_map(
    bytes: &[u8],
    primary: &[u8],
    secondary: &[u8],
) -> (ExtractionState, Option<BTreeMap<String, String>>) {
    if bytes.windows(primary.len()).any(|window| window == primary)
        || bytes
            .windows(secondary.len())
            .any(|window| window == secondary)
    {
        let mut map = BTreeMap::new();
        map.insert("present".to_string(), "true".to_string());
        (ExtractionState::Present, Some(map))
    } else {
        (ExtractionState::Absent, None)
    }
}

/// Locate the TIFF payload of a real JPEG APP1/Exif segment.
///
/// Walking the JPEG marker structure (rather than scanning the whole file for
/// the `Exif\0\0` byte string) means compressed pixel data that happens to
/// contain those bytes can never be mistaken for metadata.
fn jpeg_exif_payload(bytes: &[u8]) -> Option<&[u8]> {
    // SOI.
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return None;
    }
    let marker = b"Exif\0\0";
    let mut offset = 2usize;
    while offset + 4 <= bytes.len() {
        if bytes[offset] != 0xFF {
            // Not on a marker boundary: the structure is not walkable.
            return None;
        }
        // Skip any fill bytes.
        let mut marker_start = offset;
        while marker_start < bytes.len() && bytes[marker_start] == 0xFF {
            marker_start += 1;
        }
        if marker_start >= bytes.len() {
            return None;
        }
        let code = bytes[marker_start];
        // Standalone markers carry no length payload.
        if code == 0xD8 || (0xD0..=0xD7).contains(&code) || code == 0x01 {
            offset = marker_start + 1;
            continue;
        }
        // SOS: entropy-coded data follows; no metadata segment past here.
        if code == 0xDA || code == 0xD9 {
            return None;
        }
        let length_at = marker_start + 1;
        if length_at + 2 > bytes.len() {
            return None;
        }
        let length = u16::from_be_bytes([bytes[length_at], bytes[length_at + 1]]) as usize;
        if length < 2 {
            return None;
        }
        let payload_start = length_at + 2;
        let payload_end = length_at + length;
        if payload_end > bytes.len() {
            return None;
        }
        if code == 0xE1 {
            let payload = &bytes[payload_start..payload_end];
            if payload.len() > marker.len() && payload.starts_with(marker) {
                return Some(&payload[marker.len()..]);
            }
        }
        offset = payload_end;
    }
    None
}

/// Locate the TIFF payload of a real PNG `eXIf` chunk.
fn png_exif_payload(bytes: &[u8]) -> Option<&[u8]> {
    const SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.len() < SIGNATURE.len() || bytes[..SIGNATURE.len()] != SIGNATURE {
        return None;
    }
    let mut offset = SIGNATURE.len();
    // Each chunk: 4-byte length, 4-byte type, payload, 4-byte CRC.
    while offset + 12 <= bytes.len() {
        let length = u32::from_be_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;
        let kind = &bytes[offset + 4..offset + 8];
        let payload_start = offset + 8;
        let payload_end = payload_start.checked_add(length)?;
        if payload_end + 4 > bytes.len() {
            return None;
        }
        if kind == b"eXIf" {
            return Some(&bytes[payload_start..payload_end]);
        }
        if kind == b"IEND" {
            return None;
        }
        offset = payload_end + 4;
    }
    None
}

/// Read the EXIF orientation from a real metadata segment, if present.
pub fn exif_orientation(bytes: &[u8], format: ImageFormat) -> Option<u16> {
    extract_exif(bytes, format).0
}

/// Convert an embedded EXIF GPS coordinate into a coarse deterministic seed.
/// Raw coordinates never leave this module or enter a public manifest.
pub(crate) fn generalized_gps_seed(bytes: &[u8], format: ImageFormat) -> Option<u64> {
    let tiff = match format {
        ImageFormat::Jpeg => jpeg_exif_payload(bytes)?,
        ImageFormat::Png => png_exif_payload(bytes)?,
        _ => return None,
    };
    let (latitude, longitude) = parse_gps_coordinates(tiff).ok().flatten()?;

    Some(coarse_gps_seed(latitude, longitude))
}

fn coarse_gps_seed(latitude: f64, longitude: f64) -> u64 {
    // Ten-degree cells are intentionally coarse: this internal token cannot
    // be used to recover a photograph's fine-grained GPS position.
    let lat_band = (latitude / 10.0).floor() as i16;
    let lon_band = (longitude / 10.0).floor() as i16;
    let mut seed = 0xcbf29ce484222325_u64;
    for byte in lat_band
        .to_le_bytes()
        .into_iter()
        .chain(lon_band.to_le_bytes())
    {
        seed ^= u64::from(byte);
        seed = seed.wrapping_mul(0x100000001b3);
    }
    seed
}
fn parse_gps_coordinates(tiff: &[u8]) -> Result<Option<(f64, f64)>, ()> {
    let (little, ifd) = tiff_header(tiff).ok_or(())?;
    let Some((kind, count, value_at)) = tiff_entry(tiff, little, ifd, 0x8825) else {
        return Ok(None);
    };
    if kind != 4 || count != 1 {
        return Err(());
    }
    let gps_ifd = tiff_u32(tiff, little, value_at).ok_or(())? as usize;
    let latitude_ref = tiff_ascii_tag(tiff, little, gps_ifd, 1).ok_or(())?;
    let longitude_ref = tiff_ascii_tag(tiff, little, gps_ifd, 3).ok_or(())?;
    let mut latitude = tiff_rational_triplet(tiff, little, gps_ifd, 2).ok_or(())?;
    let mut longitude = tiff_rational_triplet(tiff, little, gps_ifd, 4).ok_or(())?;
    if !matches!(latitude_ref.as_str(), "N" | "S") || !matches!(longitude_ref.as_str(), "E" | "W") {
        return Err(());
    }
    if latitude_ref == "S" {
        latitude = -latitude;
    }
    if longitude_ref == "W" {
        longitude = -longitude;
    }
    if !latitude.is_finite()
        || !longitude.is_finite()
        || !(-90.0..=90.0).contains(&latitude)
        || !(-180.0..=180.0).contains(&longitude)
    {
        return Err(());
    }
    Ok(Some((latitude, longitude)))
}

fn tiff_header(bytes: &[u8]) -> Option<(bool, usize)> {
    let little = match bytes.get(0..2)? {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };
    let u16_at = |at: usize| tiff_u16(bytes, little, at);
    if u16_at(2)? != 42 {
        return None;
    }
    Some((little, tiff_u32(bytes, little, 4)? as usize))
}

fn tiff_u16(bytes: &[u8], little: bool, at: usize) -> Option<u16> {
    let part = bytes.get(at..at + 2)?;
    Some(if little {
        u16::from_le_bytes([part[0], part[1]])
    } else {
        u16::from_be_bytes([part[0], part[1]])
    })
}

fn tiff_u32(bytes: &[u8], little: bool, at: usize) -> Option<u32> {
    let part = bytes.get(at..at + 4)?;
    Some(if little {
        u32::from_le_bytes([part[0], part[1], part[2], part[3]])
    } else {
        u32::from_be_bytes([part[0], part[1], part[2], part[3]])
    })
}

fn tiff_entry(bytes: &[u8], little: bool, ifd: usize, tag: u16) -> Option<(u16, u32, usize)> {
    let count = usize::from(tiff_u16(bytes, little, ifd)?);
    for index in 0..count {
        let at = ifd.checked_add(2 + index * 12)?;
        if tiff_u16(bytes, little, at)? == tag {
            return Some((
                tiff_u16(bytes, little, at + 2)?,
                tiff_u32(bytes, little, at + 4)?,
                at + 8,
            ));
        }
    }
    None
}

fn tiff_u32_tag(bytes: &[u8], little: bool, ifd: usize, tag: u16) -> Option<u32> {
    let (kind, count, value_at) = tiff_entry(bytes, little, ifd, tag)?;
    if kind != 4 || count != 1 {
        return None;
    }
    tiff_u32(bytes, little, value_at)
}

fn tiff_ascii_tag(bytes: &[u8], little: bool, ifd: usize, tag: u16) -> Option<String> {
    let (kind, count, value_at) = tiff_entry(bytes, little, ifd, tag)?;
    if kind != 2 || count < 1 {
        return None;
    }
    let offset = if count <= 4 {
        value_at
    } else {
        tiff_u32(bytes, little, value_at)? as usize
    };
    let value = bytes.get(offset..offset + count as usize)?;
    Some(
        String::from_utf8_lossy(value)
            .trim_matches('\0')
            .to_string(),
    )
}

fn tiff_rational_triplet(bytes: &[u8], little: bool, ifd: usize, tag: u16) -> Option<f64> {
    let (kind, count, value_at) = tiff_entry(bytes, little, ifd, tag)?;
    if kind != 5 || count != 3 {
        return None;
    }
    let offset = tiff_u32(bytes, little, value_at)? as usize;
    let mut result = 0.0;
    for index in 0..3 {
        let at = offset.checked_add(index * 8)?;
        let numerator = f64::from(tiff_u32(bytes, little, at)?);
        let denominator = f64::from(tiff_u32(bytes, little, at + 4)?);
        if denominator == 0.0 {
            return None;
        }
        result += numerator / denominator / 60_f64.powi(index as i32);
    }
    Some(result)
}

fn extract_exif(
    bytes: &[u8],
    format: ImageFormat,
) -> (
    Option<u16>,
    ExtractionState,
    Option<BTreeMap<String, String>>,
) {
    // Only real, format-specific metadata segments are read. Arbitrary file
    // bytes that merely contain "Exif\0\0" (compressed pixel data, trailing
    // garbage) are not metadata and stay Absent.
    let (tiff, supported) = match format {
        ImageFormat::Jpeg => match jpeg_exif_payload(bytes) {
            Some(payload) => (payload, true),
            None => return (None, ExtractionState::Absent, None),
        },
        ImageFormat::Png => match png_exif_payload(bytes) {
            Some(payload) => (payload, false),
            None => return (None, ExtractionState::Absent, None),
        },
        // No validated metadata-segment reader for this format.
        _ => return (None, ExtractionState::Absent, None),
    };
    // A present EXIF segment with a readable TIFF header is Present even
    // when the Orientation tag is absent — absence is not corruption. A tag
    // that exists but is malformed is.
    let orientation = match parse_orientation(tiff) {
        Ok(value) => value,
        Err(()) => return (None, ExtractionState::Corrupt, None),
    };
    if !supported {
        return (orientation, ExtractionState::Unsupported, None);
    }
    let mut map = BTreeMap::new();
    if let Some(value) = orientation {
        map.insert("orientation".to_string(), value.to_string());
    }
    (orientation, ExtractionState::Present, Some(map))
}

/// Detect the EXIF GPSInfo pointer without reading or exposing coordinates.
fn gps_extraction_state(bytes: &[u8], format: ImageFormat) -> ExtractionState {
    let tiff = match format {
        ImageFormat::Jpeg => jpeg_exif_payload(bytes),
        ImageFormat::Png => png_exif_payload(bytes),
        _ => None,
    };
    let Some(tiff) = tiff else {
        return ExtractionState::Absent;
    };
    match parse_gps_coordinates(tiff) {
        Ok(Some(_)) => ExtractionState::Present,
        Ok(None) => ExtractionState::Absent,
        Err(()) => ExtractionState::Corrupt,
    }
}

/// Read the Orientation tag from a TIFF payload. Absent tags are `Ok(None)`;
/// a tag that exists but is malformed (wrong type, wrong count, out of the
/// 1..=8 range, or unreadable header) is `Err`.
fn parse_orientation(bytes: &[u8]) -> Result<Option<u16>, ()> {
    let (little, ifd) = tiff_header(bytes).ok_or(())?;
    let count = usize::from(tiff_u16(bytes, little, ifd).ok_or(())?);
    // The declared entry table must fit inside the payload — a count that
    // runs past the bytes is a corrupt IFD, not an absent tag.
    let entries_start = ifd.checked_add(2).ok_or(())?;
    let entries_end = entries_start
        .checked_add(count.checked_mul(12).ok_or(())?)
        .ok_or(())?;
    if entries_end > bytes.len() {
        return Err(());
    }
    let Some((kind, count, value_at)) = tiff_entry(bytes, little, ifd, 0x0112) else {
        return Ok(None);
    };
    // TIFF Orientation is SHORT (type 3) with count 1. Any other type or
    // count is malformed metadata, not a usable orientation.
    if kind != 3 || count != 1 {
        return Err(());
    }
    let value = tiff_u16(bytes, little, value_at).ok_or(())?;
    if !(1..=8).contains(&value) {
        return Err(());
    }
    Ok(Some(value))
}

fn detect_colour_profile(bytes: &[u8]) -> Option<String> {
    if bytes.windows(4).any(|window| window == b"acsp") {
        Some("ICC profile".to_string())
    } else {
        None
    }
}
fn c2pa_state_present(bytes: &[u8]) -> bool {
    bytes.windows(4).any(|window| window == b"jumb")
        || bytes.windows(4).any(|window| window == b"c2pa")
}
fn normalize_c2pa(bytes: &[u8]) -> C2paEvidence {
    let state = if c2pa_state_present(bytes) {
        C2paState::Unavailable
    } else {
        C2paState::Absent
    };
    C2paEvidence {
        state,
        validation_method: Some(C2PA_METHOD.to_string()),
        claim_generator: None,
        selected_evidence_digest: None,
    }
}

#[cfg(test)]
mod gps_tests {
    use super::{coarse_gps_seed, gps_extraction_state, parse_gps_coordinates, ExtractionState};
    use image::ImageFormat;

    #[test]
    fn coarse_seed_collapses_coordinates_into_ten_degree_cells() {
        assert_eq!(coarse_gps_seed(12.34, 56.78), coarse_gps_seed(19.99, 59.99));
        assert_ne!(coarse_gps_seed(12.34, 56.78), coarse_gps_seed(20.0, 60.0));
    }

    #[test]
    fn malformed_gps_pointer_is_not_reported_as_present() {
        let mut tiff = vec![0_u8; 22];
        tiff[0..2].copy_from_slice(b"II");
        tiff[2..4].copy_from_slice(&42_u16.to_le_bytes());
        tiff[4..8].copy_from_slice(&8_u32.to_le_bytes());
        tiff[8..10].copy_from_slice(&1_u16.to_le_bytes());
        tiff[10..12].copy_from_slice(&0x8825_u16.to_le_bytes());
        tiff[12..14].copy_from_slice(&4_u16.to_le_bytes());
        tiff[14..18].copy_from_slice(&1_u32.to_le_bytes());
        tiff[18..22].copy_from_slice(&200_u32.to_le_bytes());
        assert_eq!(parse_gps_coordinates(&tiff), Err(()));
    }

    #[test]
    fn gps_pointer_absence_is_absent_not_corrupt() {
        let mut tiff = vec![0_u8; 10];
        tiff[0..2].copy_from_slice(b"II");
        tiff[2..4].copy_from_slice(&42_u16.to_le_bytes());
        tiff[4..8].copy_from_slice(&8_u32.to_le_bytes());
        tiff[8..10].copy_from_slice(&0_u16.to_le_bytes());
        assert_eq!(parse_gps_coordinates(&tiff), Ok(None));
        assert_eq!(
            gps_extraction_state(b"not-jpeg", ImageFormat::Jpeg),
            ExtractionState::Absent
        );
    }
}
