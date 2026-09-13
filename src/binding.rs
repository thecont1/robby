//! Deterministic reproducibility binding for a compiled Robby object.
//!
//! Binding is deliberately an identity of selected inputs and policies. It is
//! not an ownership claim, a signature, or a provenance authority.
//!
//! ADR-003 (Plan 9): the canonical algorithm is version-independent. Recipe
//! languages plug in through explicit adapters that produce a
//! `CanonicalBindingRequest`; `build_binding_record` is the only producer of
//! binding identities. v1 (`robby-ir-v1`) and v2 (`robby-ir-v2`) records are
//! domain-separated by schema tags and can never collide.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sha2::{Digest, Sha256};

use crate::intake::{C2paState, EvidenceClass, IngredientManifest, Visibility};
use crate::ir::{canonical_v1_recipe_bytes, Ir, RecipeIr};

pub const BINDING_STATEMENT: &str = "This binding identifies this source, recipe, selected evidence policy, and compiler runtime. It is a reproducibility record, not an ownership certificate.";

/// Statement carried by canonical `BindingRecord`s (Plan 9 / ADR-003).
pub const CANONICAL_BINDING_STATEMENT: &str =
    "A reproducibility binding, not an ownership certificate.";

/// Domain-separation schema tag for bindings derived from `robby-ir-v1`.
pub const BINDING_SCHEMA_V1: &str = "robby-object-binding-v1";
/// Domain-separation schema tag for bindings derived from `robby-ir-v2`.
pub const BINDING_SCHEMA_V2: &str = "robby-object-binding-v2";

/// Named default disclosure policy applied to v1 recipes, which carry no
/// `bind`/`publish` clauses. Recorded as a named default, never as user
/// authorship.
pub const V1_DEFAULT_DISCLOSURE_POLICY_SCHEMA: &str = "robby-v1-default-disclosure-policy";

/// Schema tag for structured selected-evidence records.
pub const SELECTED_EVIDENCE_SCHEMA: &str = "robby-evidence-selection-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BindingOptions {
    /// Evidence selector from the recipe's `bind` clause.
    pub evidence_selection: String,
    /// Whether raw private GPS was deliberately approved for this binding.
    pub permit_private_gps: bool,
}

impl BindingOptions {
    /// Safe public default: verified summaries may contribute, private GPS may not.
    pub fn public_safe() -> Self {
        Self {
            evidence_selection: "verified_public".to_string(),
            permit_private_gps: false,
        }
    }

    pub fn none() -> Self {
        Self {
            evidence_selection: "none".to_string(),
            permit_private_gps: false,
        }
    }

    /// Read binding policy from the canonical IR, never from ad-hoc UI state.
    /// Private GPS stays out of the binding unless a later explicit permission
    /// is set on the returned options; the current recipe language has no
    /// public-GPS binding directive.
    pub fn from_recipe(recipe: &RecipeIr) -> Self {
        Self {
            evidence_selection: recipe
                .bind
                .get("evidence")
                .cloned()
                .unwrap_or_else(|| "verified_public".to_string()),
            permit_private_gps: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BindingComponents {
    pub source_byte_hash: String,
    pub canonical_pixel_hash: String,
    pub canonical_recipe_hash: String,
    pub approved_evidence_hash: String,
    pub visibility_context_policy_hash: String,
    pub runtime_hash: String,
}

impl BindingComponents {
    fn from_request(request: &CanonicalBindingRequest) -> Self {
        Self {
            source_byte_hash: request.source_byte_sha256.clone(),
            canonical_pixel_hash: request.canonical_pixel_sha256.clone(),
            canonical_recipe_hash: request.canonical_recipe_sha256.clone(),
            approved_evidence_hash: request.selected_evidence_sha256.clone(),
            visibility_context_policy_hash: request.disclosure_policy_sha256.clone(),
            runtime_hash: digest_string(
                canonical_runtime(&request.compiler_version, &request.renderer_version).as_bytes(),
            ),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BindingResult {
    pub object_binding: String,
    pub render_seed: String,
    pub display_identifier: String,
    pub component_hashes: BTreeMap<String, String>,
    pub components: BindingComponents,
    pub evidence_serialization: String,
    pub policy_serialization: String,
    pub compiler_version: String,
    pub renderer_version: String,
    pub statement: String,
}

/// Version-independent canonical binding request (ADR-003). Every identity
/// domain is explicit; adapters translate recipe-language specifics into this
/// shape before the core runs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CanonicalBindingRequest {
    pub binding_schema: String,
    pub recipe_ir_schema: String,

    pub source_byte_sha256: String,
    pub canonical_pixel_sha256: String,

    pub authored_recipe_sha256: String,
    pub canonical_recipe_sha256: String,

    pub disclosure_policy_sha256: String,
    pub selected_evidence_sha256: String,

    pub compiler_version: String,
    pub renderer_version: String,
}

/// The authoritative, versioned reproducibility record produced only by
/// `build_binding_record`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BindingRecord {
    pub schema_version: String,
    pub binding_sha256: String,
    pub short_id: String,

    pub recipe_ir_schema: String,

    pub source_byte_sha256: String,
    pub canonical_pixel_sha256: String,

    pub authored_recipe_sha256: String,
    pub canonical_recipe_sha256: String,

    pub disclosure_policy_sha256: String,
    pub selected_evidence_sha256: String,

    pub compiler_version: String,
    pub renderer_version: String,

    pub statement: String,
}

/// Structured selected evidence. Never hash human-facing display labels.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SelectedEvidence {
    pub schema: String,
    pub c2pa: C2paEvidenceSelection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct C2paEvidenceSelection {
    pub presence: String,
    pub validation: String,
    pub signer_trust: String,
    pub availability: String,
}

impl SelectedEvidence {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != SELECTED_EVIDENCE_SCHEMA {
            return Err(format!(
                "Unknown evidence schema `{}`. Expected `{SELECTED_EVIDENCE_SCHEMA}`.",
                self.schema
            ));
        }
        Ok(())
    }

    /// Canonical serialization hashed into `selected_evidence_sha256`.
    pub fn canonical_bytes(&self) -> String {
        serde_json::to_string(self).expect("selected evidence serializes")
    }
}

/// The named default v1 disclosure policy. v1 recipes author no `bind` or
/// `publish` clauses, so the policy is a recorded default rather than a claim
/// of user authorship.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct V1DisclosurePolicy {
    pub schema: String,
    pub gps: String,
    pub raw_metadata: String,
    pub source_pixels: String,
    pub c2pa: String,
}

impl V1DisclosurePolicy {
    pub fn default_v1() -> Self {
        Self {
            schema: V1_DEFAULT_DISCLOSURE_POLICY_SCHEMA.to_string(),
            gps: "private".to_string(),
            raw_metadata: "omitted".to_string(),
            source_pixels: "omitted".to_string(),
            c2pa: "summary/status-only".to_string(),
        }
    }

    /// Canonical serialization hashed into `disclosure_policy_sha256`.
    pub fn canonical_bytes(&self) -> String {
        serde_json::to_string(self).expect("disclosure policy serializes")
    }
}

/// The only canonical binding algorithm (ADR-003). Given a validated
/// `CanonicalBindingRequest`, produce the authoritative `BindingRecord`.
///
/// The preimage is a NUL-separated, key=value encoding with domain separation
/// and every identity domain, exactly as specified by Plan 9:
///
/// ```text
/// robby-object-binding-v1 NUL recipe-ir-schema=… NUL source-byte-sha256=…
/// NUL canonical-pixel-sha256=… NUL authored-recipe-sha256=…
/// NUL canonical-recipe-sha256=… NUL disclosure-policy-sha256=…
/// NUL selected-evidence-sha256=… NUL compiler-version=… NUL renderer-version=…
/// ```
pub fn build_binding_record(request: &CanonicalBindingRequest) -> Result<BindingRecord, String> {
    validate_tag(&request.binding_schema, "binding_schema")?;
    validate_tag(&request.recipe_ir_schema, "recipe_ir_schema")?;
    validate_digest(&request.source_byte_sha256, "source_byte_sha256")?;
    validate_digest(&request.canonical_pixel_sha256, "canonical_pixel_sha256")?;
    validate_digest(&request.authored_recipe_sha256, "authored_recipe_sha256")?;
    validate_digest(&request.canonical_recipe_sha256, "canonical_recipe_sha256")?;
    validate_digest(
        &request.disclosure_policy_sha256,
        "disclosure_policy_sha256",
    )?;
    validate_digest(
        &request.selected_evidence_sha256,
        "selected_evidence_sha256",
    )?;
    validate_tag(&request.compiler_version, "compiler_version")?;
    validate_tag(&request.renderer_version, "renderer_version")?;

    let preimage = [
        request.binding_schema.clone(),
        format!("recipe-ir-schema={}", request.recipe_ir_schema),
        format!("source-byte-sha256={}", request.source_byte_sha256),
        format!("canonical-pixel-sha256={}", request.canonical_pixel_sha256),
        format!("authored-recipe-sha256={}", request.authored_recipe_sha256),
        format!(
            "canonical-recipe-sha256={}",
            request.canonical_recipe_sha256
        ),
        format!(
            "disclosure-policy-sha256={}",
            request.disclosure_policy_sha256
        ),
        format!(
            "selected-evidence-sha256={}",
            request.selected_evidence_sha256
        ),
        format!("compiler-version={}", request.compiler_version),
        format!("renderer-version={}", request.renderer_version),
    ]
    .join("\u{0}");
    let binding_sha256 = digest_string(preimage.as_bytes());
    let short_id = short_id(&binding_sha256);
    Ok(BindingRecord {
        schema_version: "robby-binding-record-v1".to_string(),
        binding_sha256: binding_sha256.clone(),
        short_id,
        recipe_ir_schema: request.recipe_ir_schema.clone(),
        source_byte_sha256: request.source_byte_sha256.clone(),
        canonical_pixel_sha256: request.canonical_pixel_sha256.clone(),
        authored_recipe_sha256: request.authored_recipe_sha256.clone(),
        canonical_recipe_sha256: request.canonical_recipe_sha256.clone(),
        disclosure_policy_sha256: request.disclosure_policy_sha256.clone(),
        selected_evidence_sha256: request.selected_evidence_sha256.clone(),
        compiler_version: request.compiler_version.clone(),
        renderer_version: request.renderer_version.clone(),
        statement: CANONICAL_BINDING_STATEMENT.to_string(),
    })
}

fn short_id(binding_sha256: &str) -> String {
    format!(
        "RB-{}-{}",
        binding_sha256[0..4].to_uppercase(),
        binding_sha256[4..8].to_uppercase()
    )
}

fn validate_digest(value: &str, field: &str) -> Result<(), String> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return Err(format!(
            "{field} must be exactly 64 lowercase hex characters."
        ));
    }
    Ok(())
}

fn validate_tag(value: &str, field: &str) -> Result<(), String> {
    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_graphic() && b != b'=') {
        return Err(format!(
            "{field} must be non-empty printable ASCII without NUL or `=`."
        ));
    }
    Ok(())
}

/// Build a canonical binding request from the active `robby-ir-v1` language.
///
/// The intake manifest supplies the byte and canonical-pixel identities. The
/// canonical v1 recipe identity is the Rust-defined canonical serialization of
/// the lowered typed IR (formatting-independent); the authored identity is the
/// exact submitted recipe source bytes. Policy is the named v1 default.
pub fn binding_request_from_ir_v1(
    intake: &IngredientManifest,
    ir: &Ir,
    authored_recipe_sha256: &str,
    policy: &V1DisclosurePolicy,
    evidence: &SelectedEvidence,
    compiler_version: &str,
    renderer_version: &str,
) -> CanonicalBindingRequest {
    CanonicalBindingRequest {
        binding_schema: BINDING_SCHEMA_V1.to_string(),
        recipe_ir_schema: ir.version.clone(),
        source_byte_sha256: intake.obverse.byte_sha256.clone(),
        canonical_pixel_sha256: intake.obverse.pixel_sha256.clone(),
        authored_recipe_sha256: authored_recipe_sha256.to_string(),
        canonical_recipe_sha256: digest_string(canonical_v1_recipe_bytes(ir).as_bytes()),
        disclosure_policy_sha256: digest_string(policy.canonical_bytes().as_bytes()),
        selected_evidence_sha256: digest_string(evidence.canonical_bytes().as_bytes()),
        compiler_version: compiler_version.to_string(),
        renderer_version: renderer_version.to_string(),
    }
}

/// Build a canonical binding request from the Phase-3 `robby-ir-v2` recipe IR.
///
/// v2 recipes carry their own `bind`/`publish` clauses; policy and evidence
/// serializations come from the validated recipe and options. As in v1, the
/// authored identity is the digest of the exact submitted source bytes, so
/// two sources that differ only in formatting stay distinguishable in the
/// authored domain while sharing a canonical digest.
pub fn binding_request_from_recipe_ir_v2(
    manifest: &IngredientManifest,
    recipe: &RecipeIr,
    authored_recipe_sha256: &str,
    options: &BindingOptions,
    compiler_version: &str,
    renderer_version: &str,
) -> CanonicalBindingRequest {
    let evidence_serialization = canonical_approved_evidence(manifest, options);
    let policy_serialization = canonical_visibility_context_policy(recipe, options);
    CanonicalBindingRequest {
        binding_schema: BINDING_SCHEMA_V2.to_string(),
        recipe_ir_schema: recipe.version.clone(),
        source_byte_sha256: manifest.obverse.byte_sha256.clone(),
        canonical_pixel_sha256: manifest.obverse.pixel_sha256.clone(),
        authored_recipe_sha256: authored_recipe_sha256.to_string(),
        canonical_recipe_sha256: recipe.recipe_sha256.clone(),
        disclosure_policy_sha256: digest_string(policy_serialization.as_bytes()),
        selected_evidence_sha256: digest_string(evidence_serialization.as_bytes()),
        compiler_version: compiler_version.to_string(),
        renderer_version: renderer_version.to_string(),
    }
}

/// Build all legacy v2 binding material through the canonical core.
///
/// `authored_recipe_sha256` is the digest of the exact submitted source text.
pub fn build_binding(
    manifest: &IngredientManifest,
    recipe: &RecipeIr,
    authored_recipe_sha256: &str,
    options: &BindingOptions,
    compiler_version: &str,
    renderer_version: &str,
) -> BindingResult {
    let request = binding_request_from_recipe_ir_v2(
        manifest,
        recipe,
        authored_recipe_sha256,
        options,
        compiler_version,
        renderer_version,
    );
    let record = build_binding_record(&request).expect("v2 adapter produces a valid request");
    let evidence_serialization = canonical_approved_evidence(manifest, options);
    let policy_serialization = canonical_visibility_context_policy(recipe, options);
    let components = BindingComponents::from_request(&request);
    let component_hashes = BTreeMap::from([
        (
            "source_byte_hash".into(),
            components.source_byte_hash.clone(),
        ),
        (
            "canonical_pixel_hash".into(),
            components.canonical_pixel_hash.clone(),
        ),
        (
            "canonical_recipe_hash".into(),
            components.canonical_recipe_hash.clone(),
        ),
        (
            "approved_evidence_hash".into(),
            components.approved_evidence_hash.clone(),
        ),
        (
            "visibility_context_policy_hash".into(),
            components.visibility_context_policy_hash.clone(),
        ),
        ("runtime_hash".into(), components.runtime_hash.clone()),
    ]);
    BindingResult {
        object_binding: record.binding_sha256.clone(),
        render_seed: record.binding_sha256[..16].to_string(),
        display_identifier: record.short_id.clone(),
        component_hashes,
        components,
        evidence_serialization,
        policy_serialization,
        compiler_version: compiler_version.to_string(),
        renderer_version: renderer_version.to_string(),
        statement: BINDING_STATEMENT.to_string(),
    }
}

/// Serialize only evidence explicitly approved by the binding policy.
///
/// Raw private metadata is intentionally not traversed into the public-safe
/// representation. GPS is an explicit opt-in, even when another policy changes.
pub fn canonical_approved_evidence(
    manifest: &IngredientManifest,
    options: &BindingOptions,
) -> String {
    let mut selected = BTreeMap::new();
    selected.insert("selection".to_string(), json!(options.evidence_selection));
    if options.evidence_selection == "verified_public"
        && manifest.evidence.c2pa.classification == EvidenceClass::Verified
        // "verified_public" means exactly that: a verified field whose
        // visibility is Public. A Private or Redacted field must never have
        // its digest serialized into the binding preimage.
        && manifest.evidence.c2pa.visibility == Visibility::Public
    {
        if let Some(c2pa) = manifest.evidence.c2pa.value.as_ref() {
            if c2pa.state == C2paState::Present {
                selected.insert(
                    "c2pa".to_string(),
                    json!({
                        "state": c2pa.state,
                        "validation_method": c2pa.validation_method,
                        "selected_evidence_digest": c2pa.selected_evidence_digest,
                    }),
                );
            }
        }
    }
    if options.permit_private_gps && manifest.evidence.gps.visibility == Visibility::Private {
        if let Some(gps) = manifest.evidence.gps.value.as_ref() {
            selected.insert("gps".to_string(), json!(gps));
        }
    }
    canonical_json(json!(selected))
}

/// Serialize recipe context and publication decisions independently of evidence.
pub fn canonical_visibility_context_policy(recipe: &RecipeIr, options: &BindingOptions) -> String {
    canonical_json(json!({
        "bind": recipe.bind,
        "context": recipe.context,
        "publish": recipe.publish,
        "evidence_selection": options.evidence_selection,
        "permit_private_gps": options.permit_private_gps,
    }))
}

fn canonical_runtime(compiler_version: &str, renderer_version: &str) -> String {
    canonical_json(json!({
        "compiler_version": compiler_version,
        "renderer_version": renderer_version,
    }))
}

fn canonical_json(value: JsonValue) -> String {
    serde_json::to_string(&sort_json(value)).expect("binding JSON serializes")
}

fn sort_json(value: JsonValue) -> JsonValue {
    match value {
        JsonValue::Object(object) => JsonValue::Object(
            object
                .into_iter()
                .map(|(key, value)| (key, sort_json(value)))
                .collect::<serde_json::Map<_, _>>(),
        ),
        JsonValue::Array(values) => JsonValue::Array(values.into_iter().map(sort_json).collect()),
        other => other,
    }
}

fn digest_string(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
