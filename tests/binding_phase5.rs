use std::collections::BTreeMap;

use robby_compiler::binding::{
    build_binding, canonical_approved_evidence, canonical_visibility_context_policy,
    BindingOptions, BINDING_STATEMENT,
};
use robby_compiler::compile_recipe_source;
use robby_compiler::intake::{
    C2paEvidence, C2paState, Evidence, EvidenceClass, EvidenceField, ExtractionState,
    IngredientManifest, Obverse, Visibility,
};

const RECIPE: &str = r#"
object "binding-test" {
  input "source.jpg"
  inspect {
    exif: read
    iptc: read
    xmp: read
    c2pa: verify
    gps: private
  }
  context {
    place: set "Bengaluru, India"
    source_gps: keep private
  }
  split palette {
    method: median_cut
    colours: 8
    order: frequency
  }
  measure {
    luminance: bands(8)
    texture: grid(24)
  }
  bind {
    source: sha256
    pixels: canonical_rgba_sha256
    recipe: canonical_ir
    evidence: verified_public
    compiler: version
  }
  reverse palette_grid {
    cell: 10
    arrange: seeded_shuffle
    seed: object_binding
    border: source_palette
  }
  publish {
    gps: remove
    capture_time: redact
    c2pa: summary
    manifest: public_safe
  }
}
"#;

/// The authored digest for these fixtures: the exact submitted source bytes.
fn authored_digest() -> String {
    use sha2::Digest;
    format!("{:x}", sha2::Sha256::digest(RECIPE.as_bytes()))
}

fn manifest() -> IngredientManifest {
    let mut gps = BTreeMap::new();
    gps.insert("latitude".into(), 12.9716);
    gps.insert("longitude".into(), 77.5946);
    let c2pa = C2paEvidence {
        state: C2paState::Present,
        validation_method: Some("fixture-validator".into()),
        claim_generator: Some("fixture-generator".into()),
        selected_evidence_digest: Some("safe-claim-digest".into()),
    };
    let c2pa_field = EvidenceField {
        classification: EvidenceClass::Verified,
        value: Some(c2pa.clone()),
        visibility: Visibility::Public,
        source: Some("fixture".into()),
        state: ExtractionState::Present,
        note: None,
    };
    IngredientManifest {
        schema_version: "0.2".into(),
        obverse: Obverse {
            original_name: "source.jpg".into(),
            mime_type: "image/jpeg".into(),
            byte_size: 4,
            byte_sha256: "11".repeat(32),
            pixel_sha256: "22".repeat(32),
            width: 1,
            height: 1,
            orientation: Some(1),
            colour_profile: None,
        },
        evidence: Evidence {
            exif: EvidenceField {
                classification: EvidenceClass::Observed,
                value: Some(BTreeMap::from([("camera".into(), "private-camera".into())])),
                visibility: Visibility::Private,
                source: Some("EXIF".into()),
                state: ExtractionState::Present,
                note: None,
            },
            iptc: EvidenceField {
                classification: EvidenceClass::Unavailable,
                value: None,
                visibility: Visibility::Private,
                source: Some("IPTC".into()),
                state: ExtractionState::Absent,
                note: None,
            },
            xmp: EvidenceField {
                classification: EvidenceClass::Unavailable,
                value: None,
                visibility: Visibility::Private,
                source: Some("XMP".into()),
                state: ExtractionState::Absent,
                note: None,
            },
            gps: EvidenceField {
                classification: EvidenceClass::Observed,
                value: Some(gps),
                visibility: Visibility::Private,
                source: Some("GPS".into()),
                state: ExtractionState::Present,
                note: None,
            },
            c2pa: c2pa_field,
        },
    }
}

#[test]
fn public_evidence_serialization_excludes_private_gps_and_raw_private_metadata() {
    let value = canonical_approved_evidence(&manifest(), &BindingOptions::public_safe());
    assert!(value.contains("safe-claim-digest"));
    assert!(!value.contains("12.9716"));
    assert!(!value.contains("private-camera"));
}

#[test]
fn verified_c2pa_digest_requires_public_visibility() {
    let public = manifest();
    let options = BindingOptions::public_safe();
    assert!(canonical_approved_evidence(&public, &options).contains("safe-claim-digest"));

    for visibility in [Visibility::Private, Visibility::Redacted] {
        let mut non_public = public.clone();
        non_public.evidence.c2pa.visibility = visibility;
        let serialized = canonical_approved_evidence(&non_public, &options);
        assert!(!serialized.contains("safe-claim-digest"));
        assert!(!serialized.contains("selected_evidence_digest"));
    }
}

#[test]
fn private_gps_enters_binding_only_when_explicitly_permitted() {
    let source = manifest();
    let denied = BindingOptions::public_safe();
    let mut permitted = denied.clone();
    permitted.permit_private_gps = true;
    let denied_evidence = canonical_approved_evidence(&source, &denied);
    let permitted_evidence = canonical_approved_evidence(&source, &permitted);
    assert!(!denied_evidence.contains("12.9716"));
    assert!(permitted_evidence.contains("12.9716"));
    assert_ne!(denied_evidence, permitted_evidence);
}

#[test]
fn policy_serialization_is_stable_for_equivalent_recipe_formatting() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let compact = compile_recipe_source(&RECIPE.replace('\n', " ")).unwrap();
    let options = BindingOptions::public_safe();
    assert_eq!(
        canonical_visibility_context_policy(&recipe, &options),
        canonical_visibility_context_policy(&compact, &options)
    );
}

#[test]
fn binding_is_deterministic_and_exposes_reproducibility_components() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let source = manifest();
    let options = BindingOptions::public_safe();
    let first = build_binding(
        &source,
        &recipe,
        &authored_digest(),
        &options,
        "compiler-a",
        "renderer-a",
    );
    let second = build_binding(
        &source,
        &recipe,
        &authored_digest(),
        &options,
        "compiler-a",
        "renderer-a",
    );
    assert_eq!(first, second);
    assert_eq!(first.object_binding.len(), 64);
    assert_eq!(first.render_seed.len(), 16);
    assert!(first.display_identifier.starts_with("RB-"));
    assert_eq!(first.component_hashes.len(), 6);
    assert_eq!(first.statement, BINDING_STATEMENT);
}

#[test]
fn every_binding_input_change_changes_object_binding() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let source = manifest();
    let options = BindingOptions::public_safe();
    let baseline = build_binding(
        &source,
        &recipe,
        &authored_digest(),
        &options,
        "compiler-a",
        "renderer-a",
    );
    let mut changed_source = source.clone();
    changed_source.obverse.byte_sha256 = "33".repeat(32);
    let changed_bytes = build_binding(
        &changed_source,
        &recipe,
        &authored_digest(),
        &options,
        "compiler-a",
        "renderer-a",
    );
    let changed_recipe =
        compile_recipe_source(&RECIPE.replace("colours: 8", "colours: 9")).unwrap();
    let changed_recipe_binding = build_binding(
        &source,
        &changed_recipe,
        &authored_digest(),
        &options,
        "compiler-a",
        "renderer-a",
    );
    let changed_runtime = build_binding(
        &source,
        &recipe,
        &authored_digest(),
        &options,
        "compiler-b",
        "renderer-a",
    );
    assert_ne!(baseline.object_binding, changed_bytes.object_binding);
    assert_ne!(
        baseline.object_binding,
        changed_recipe_binding.object_binding
    );
    assert_ne!(baseline.object_binding, changed_runtime.object_binding);
}

#[test]
fn display_identifier_is_a_short_binding_fingerprint() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let binding = build_binding(
        &manifest(),
        &recipe,
        &authored_digest(),
        &BindingOptions::public_safe(),
        "compiler-a",
        "renderer-a",
    );
    assert_eq!(
        binding.display_identifier,
        format!(
            "RB-{}-{}",
            binding.object_binding[0..4].to_uppercase(),
            binding.object_binding[4..8].to_uppercase()
        )
    );
}

#[test]
fn evidence_none_excludes_verified_c2pa_and_changes_binding() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let source = manifest();
    let public = BindingOptions::public_safe();
    let none = BindingOptions::none();
    let public_evidence = canonical_approved_evidence(&source, &public);
    let none_evidence = canonical_approved_evidence(&source, &none);
    assert!(public_evidence.contains("safe-claim-digest"));
    assert!(!none_evidence.contains("safe-claim-digest"));
    assert_ne!(
        build_binding(
            &source,
            &recipe,
            &authored_digest(),
            &public,
            "compiler-a",
            "renderer-a"
        )
        .object_binding,
        build_binding(
            &source,
            &recipe,
            &authored_digest(),
            &none,
            "compiler-a",
            "renderer-a"
        )
        .object_binding
    );
}

#[test]
fn recipe_bind_clause_selects_the_evidence_policy() {
    let verified = compile_recipe_source(RECIPE).unwrap();
    let none_source = RECIPE.replace("evidence: verified_public", "evidence: none");
    let none = compile_recipe_source(&none_source).expect("evidence: none is a supported control");
    assert_eq!(
        BindingOptions::from_recipe(&verified).evidence_selection,
        "verified_public"
    );
    assert_eq!(
        BindingOptions::from_recipe(&none).evidence_selection,
        "none"
    );
    assert!(!BindingOptions::from_recipe(&verified).permit_private_gps);
}

#[test]
fn metadata_only_private_gps_does_not_change_public_safe_binding() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let source = manifest();
    let mut without_gps = source.clone();
    without_gps.evidence.gps.value = None;
    without_gps.evidence.gps.state = ExtractionState::Absent;
    let options = BindingOptions::from_recipe(&recipe);
    assert_eq!(
        build_binding(
            &source,
            &recipe,
            &authored_digest(),
            &options,
            "compiler-a",
            "renderer-a"
        )
        .object_binding,
        build_binding(
            &without_gps,
            &recipe,
            &authored_digest(),
            &options,
            "compiler-a",
            "renderer-a"
        )
        .object_binding
    );
}

#[test]
fn recipe_evidence_none_changes_binding_through_from_recipe() {
    let verified = compile_recipe_source(RECIPE).unwrap();
    let none =
        compile_recipe_source(&RECIPE.replace("evidence: verified_public", "evidence: none"))
            .unwrap();
    let source = manifest();
    assert_ne!(
        build_binding(
            &source,
            &verified,
            &authored_digest(),
            &BindingOptions::from_recipe(&verified),
            "compiler-a",
            "renderer-a"
        )
        .object_binding,
        build_binding(
            &source,
            &none,
            &authored_digest(),
            &BindingOptions::from_recipe(&none),
            "compiler-a",
            "renderer-a"
        )
        .object_binding
    );
}

#[test]
fn pixel_hash_and_renderer_version_are_binding_inputs() {
    let recipe = compile_recipe_source(RECIPE).unwrap();
    let source = manifest();
    let options = BindingOptions::public_safe();
    let baseline = build_binding(
        &source,
        &recipe,
        &authored_digest(),
        &options,
        "compiler-a",
        "renderer-a",
    );
    let mut pixels = source.clone();
    pixels.obverse.pixel_sha256 = "44".repeat(32);
    assert_ne!(
        baseline.object_binding,
        build_binding(
            &pixels,
            &recipe,
            &authored_digest(),
            &options,
            "compiler-a",
            "renderer-a"
        )
        .object_binding
    );
    assert_ne!(
        baseline.object_binding,
        build_binding(
            &source,
            &recipe,
            &authored_digest(),
            &options,
            "compiler-a",
            "renderer-b"
        )
        .object_binding
    );
}

#[test]
fn public_safe_evidence_omits_c2pa_claim_generator() {
    let value = canonical_approved_evidence(&manifest(), &BindingOptions::public_safe());
    assert!(!value.contains("fixture-generator"));
}
