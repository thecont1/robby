//! Deterministic reproducibility binding for a compiled Robby object.
//!
//! Binding is deliberately an identity of selected inputs and policies. It is
//! not an ownership claim, a signature, or a provenance authority.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sha2::{Digest, Sha256};

use crate::intake::{C2paState, EvidenceClass, IngredientManifest, Visibility};
use crate::ir::RecipeIr;

pub const BINDING_STATEMENT: &str = "This binding identifies this source, recipe, selected evidence policy, and compiler runtime. It is a reproducibility record, not an ownership certificate.";

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

/// Build all binding material from the already validated intake manifest and IR.
pub fn build_binding(
    manifest: &IngredientManifest,
    recipe: &RecipeIr,
    options: &BindingOptions,
    compiler_version: &str,
    renderer_version: &str,
) -> BindingResult {
    let evidence_serialization = canonical_approved_evidence(manifest, options);
    let policy_serialization = canonical_visibility_context_policy(recipe, options);
    let components = BindingComponents {
        source_byte_hash: manifest.obverse.byte_sha256.clone(),
        canonical_pixel_hash: manifest.obverse.pixel_sha256.clone(),
        canonical_recipe_hash: recipe.recipe_sha256.clone(),
        approved_evidence_hash: digest_string(evidence_serialization.as_bytes()),
        visibility_context_policy_hash: digest_string(policy_serialization.as_bytes()),
        runtime_hash: digest_string(
            canonical_runtime(compiler_version, renderer_version).as_bytes(),
        ),
    };
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
    let object_binding = digest_concat(&[
        &components.source_byte_hash,
        &components.canonical_pixel_hash,
        &components.canonical_recipe_hash,
        &components.approved_evidence_hash,
        &components.visibility_context_policy_hash,
        &components.runtime_hash,
    ]);
    let render_seed = object_binding[..16].to_string();
    let display_identifier = format!(
        "RB-{}-{}",
        object_binding[..4].to_uppercase(),
        object_binding[4..8].to_uppercase()
    );
    BindingResult {
        object_binding,
        render_seed,
        display_identifier,
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

fn digest_concat(parts: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for part in parts {
        hasher.update(part.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

fn digest_string(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
