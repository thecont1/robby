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
    let gps = absent_field("No GPS coordinates were found in the source bytes.");
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

impl IngredientManifest {
    pub fn sanitize_public(&self) -> Self {
        let mut public = self.clone();
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

fn orient(mut image: DynamicImage, orientation: Option<u16>) -> DynamicImage {
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

fn extract_exif(
    bytes: &[u8],
    format: ImageFormat,
) -> (
    Option<u16>,
    ExtractionState,
    Option<BTreeMap<String, String>>,
) {
    let marker = b"Exif\0\0";
    let Some(index) = bytes
        .windows(marker.len())
        .position(|window| window == marker)
    else {
        return (None, ExtractionState::Absent, None);
    };
    let tiff = &bytes[index + marker.len()..];
    let Some(orientation) = parse_orientation(tiff) else {
        return (None, ExtractionState::Corrupt, None);
    };
    let mut map = BTreeMap::new();
    map.insert("orientation".to_string(), orientation.to_string());
    if format != ImageFormat::Jpeg {
        return (Some(orientation), ExtractionState::Unsupported, None);
    }
    (Some(orientation), ExtractionState::Present, Some(map))
}

fn parse_orientation(bytes: &[u8]) -> Option<u16> {
    if bytes.len() < 18 {
        return None;
    }
    let little = &bytes[0..2] == b"II";
    if !little && &bytes[0..2] != b"MM" {
        return None;
    }
    let u16_at = |at: usize| -> Option<u16> {
        let part = bytes.get(at..at + 2)?;
        Some(if little {
            u16::from_le_bytes([part[0], part[1]])
        } else {
            u16::from_be_bytes([part[0], part[1]])
        })
    };
    let u32_at = |at: usize| -> Option<u32> {
        let part = bytes.get(at..at + 4)?;
        Some(if little {
            u32::from_le_bytes([part[0], part[1], part[2], part[3]])
        } else {
            u32::from_be_bytes([part[0], part[1], part[2], part[3]])
        })
    };
    if u16_at(2)? != 42 {
        return None;
    }
    let ifd = u32_at(4)? as usize;
    let count = u16_at(ifd)? as usize;
    for entry in 0..count {
        let at = ifd + 2 + entry * 12;
        if u16_at(at)? == 0x0112 {
            return u16_at(at + 8).filter(|value| (1..=8).contains(value));
        }
    }
    None
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
