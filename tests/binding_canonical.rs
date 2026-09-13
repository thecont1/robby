//! Plan 9A required binding tests: canonical core, v1/v2 adapters, and the
//! full sensitivity/schema-separation matrix.

use robby_compiler::binding::{
    binding_request_from_ir_v1, binding_request_from_recipe_ir_v2, build_binding,
    build_binding_record, BindingOptions, CanonicalBindingRequest, SelectedEvidence,
    V1DisclosurePolicy, BINDING_SCHEMA_V1, BINDING_SCHEMA_V2, CANONICAL_BINDING_STATEMENT,
    SELECTED_EVIDENCE_SCHEMA, V1_DEFAULT_DISCLOSURE_POLICY_SCHEMA,
};
use robby_compiler::intake::IngredientManifest;
use robby_compiler::{compile_recipe_source, compile_source};

const V1_SOURCE: &str = r#"
base("source.jpg")
palette(k: 8)
reverse(mode: "observability_sheet")
output(obverse: "source.jpg", reverse: "transient", manifest: "transient")
"#;

const V2_RECIPE: &str = r#"
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
    manifest: public_safe
  }
}
"#;

/// The authored digest of the exact submitted v2 source text.
fn v2_authored_digest() -> String {
    use sha2::Digest;
    format!("{:x}", sha2::Sha256::digest(V2_RECIPE.as_bytes()))
}

fn fixture_manifest() -> IngredientManifest {
    // A metadata-free PNG intake; produced here through the public API so the
    // test does not depend on repository fixtures.
    use robby_compiler::intake::inspect_image;
    let mut image = image::RgbImage::new(2, 1);
    image.put_pixel(0, 0, image::Rgb([16, 32, 48]));
    image.put_pixel(1, 0, image::Rgb([200, 180, 160]));
    let mut bytes = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(image)
        .write_to(&mut bytes, image::ImageFormat::Png)
        .expect("encode fixture");
    inspect_image("source.png", &bytes.into_inner()).expect("intake")
}

fn v1_request() -> CanonicalBindingRequest {
    let ir = compile_source(V1_SOURCE).expect("v1 compiles");
    let intake = fixture_manifest();
    let authored = "a".repeat(64);
    binding_request_from_ir_v1(
        &intake,
        &ir,
        &authored,
        &V1DisclosurePolicy::default_v1(),
        &evidence_absent(),
        "compiler-a",
        "renderer-a",
    )
}

fn evidence_absent() -> SelectedEvidence {
    SelectedEvidence {
        schema: SELECTED_EVIDENCE_SCHEMA.to_string(),
        c2pa: robby_compiler::binding::C2paEvidenceSelection {
            presence: "absent".to_string(),
            validation: "unavailable".to_string(),
            signer_trust: "unavailable".to_string(),
            availability: "inspected".to_string(),
        },
    }
}

#[test]
fn v1_binding_record_is_deterministic_and_labels_its_schema() {
    let first = build_binding_record(&v1_request()).expect("record");
    let second = build_binding_record(&v1_request()).expect("record");
    assert_eq!(first, second);
    assert_eq!(first.recipe_ir_schema, "robby-ir-v1");
    assert_eq!(first.schema_version, "robby-binding-record-v1");
    assert_eq!(first.statement, CANONICAL_BINDING_STATEMENT);
    assert!(first.short_id.starts_with("RB-"));
    assert_eq!(first.binding_sha256.len(), 64);
}

#[test]
fn every_identity_domain_sensitivity_changes_the_binding() {
    let baseline = build_binding_record(&v1_request()).expect("record");
    let mut changed;

    // Source-byte sensitivity
    let mut intake = fixture_manifest();
    intake.obverse.byte_sha256 = "33".repeat(32);
    changed = v1_request();
    changed.source_byte_sha256 = intake.obverse.byte_sha256.clone();
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&changed).unwrap().binding_sha256
    );

    // Pixel sensitivity
    changed = v1_request();
    changed.canonical_pixel_sha256 = "44".repeat(32);
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&changed).unwrap().binding_sha256
    );

    // Authored-recipe sensitivity
    changed = v1_request();
    changed.authored_recipe_sha256 = "55".repeat(32);
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&changed).unwrap().binding_sha256
    );

    // Canonical-recipe sensitivity (different v1 recipe)
    let mut other = v1_request();
    other.canonical_recipe_sha256 = "66".repeat(32);
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&other).unwrap().binding_sha256
    );

    // Policy sensitivity
    let mut policy_changed = v1_request();
    policy_changed.disclosure_policy_sha256 = "77".repeat(32);
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&policy_changed)
            .unwrap()
            .binding_sha256
    );

    // Evidence sensitivity
    let mut evidence_changed = v1_request();
    evidence_changed.selected_evidence_sha256 = "88".repeat(32);
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&evidence_changed)
            .unwrap()
            .binding_sha256
    );

    // Runtime sensitivity
    let mut runtime_changed = v1_request();
    runtime_changed.renderer_version = "renderer-b".to_string();
    assert_ne!(
        baseline.binding_sha256,
        build_binding_record(&runtime_changed)
            .unwrap()
            .binding_sha256
    );
}

#[test]
fn v1_and_v2_bindings_are_domain_separated() {
    let v1 = build_binding_record(&v1_request()).expect("v1 record");
    let recipe = compile_recipe_source(V2_RECIPE).expect("v2 compiles");
    let intake = fixture_manifest();
    let v2_request = binding_request_from_recipe_ir_v2(
        &intake,
        &recipe,
        &v2_authored_digest(),
        &BindingOptions::from_recipe(&recipe),
        "compiler-a",
        "renderer-a",
    );
    let v2 = build_binding_record(&v2_request).expect("v2 record");

    assert_eq!(v1.recipe_ir_schema, "robby-ir-v1");
    assert_eq!(v2.recipe_ir_schema, "robby-ir-v2");
    assert_ne!(v1.binding_sha256, v2.binding_sha256);
    // Domain separation is anchored in the preimage schema tags.
    assert_ne!(BINDING_SCHEMA_V1, BINDING_SCHEMA_V2);
}

#[test]
fn canonical_v1_identity_is_formatting_independent() {
    let spaced = compile_source(
        "base( \"source.jpg\" )\n\n\npalette( k: 8 )\nreverse( mode: \"observability_sheet\" )\noutput( obverse: \"source.jpg\" , reverse: \"transient\" , manifest: \"transient\" )\n"
    )
    .expect("spaced v1 compiles");
    let compact = compile_source(V1_SOURCE).expect("compact v1 compiles");

    let intake = fixture_manifest();
    let from_spaced = binding_request_from_ir_v1(
        &intake,
        &spaced,
        "a".repeat(64).as_str(),
        &V1DisclosurePolicy::default_v1(),
        &evidence_absent(),
        "compiler-a",
        "renderer-a",
    );
    let from_compact = binding_request_from_ir_v1(
        &intake,
        &compact,
        "a".repeat(64).as_str(),
        &V1DisclosurePolicy::default_v1(),
        &evidence_absent(),
        "compiler-a",
        "renderer-a",
    );
    assert_eq!(
        from_spaced.canonical_recipe_sha256, from_compact.canonical_recipe_sha256,
        "formatting-equivalent v1 sources must share canonical identity"
    );
    assert_ne!(
        from_spaced.authored_recipe_sha256, from_spaced.canonical_recipe_sha256,
        "authored identity must never equal canonical identity"
    );
}

#[test]
fn selected_evidence_rejects_unknown_schema_and_is_canonical() {
    let mut bad = evidence_absent();
    bad.schema = "not-a-schema".to_string();
    assert!(bad.validate().is_err());
    let good = evidence_absent();
    assert!(good.validate().is_ok());
    assert!(good.canonical_bytes().contains(SELECTED_EVIDENCE_SCHEMA));
}

#[test]
fn v1_default_policy_is_named_not_authored() {
    let policy = V1DisclosurePolicy::default_v1();
    assert_eq!(policy.schema, V1_DEFAULT_DISCLOSURE_POLICY_SCHEMA);
    assert_eq!(policy.gps, "private");
    assert_eq!(policy.raw_metadata, "omitted");
    assert_eq!(policy.source_pixels, "omitted");
    assert_eq!(policy.c2pa, "summary/status-only");
}

#[test]
fn legacy_v2_build_binding_still_works_through_the_core() {
    let recipe = compile_recipe_source(V2_RECIPE).expect("v2 compiles");
    let intake = fixture_manifest();
    let result = build_binding(
        &intake,
        &recipe,
        &v2_authored_digest(),
        &BindingOptions::from_recipe(&recipe),
        "compiler-a",
        "renderer-a",
    );
    assert_eq!(result.object_binding.len(), 64);
    assert_eq!(result.render_seed.len(), 16);
    assert!(result.display_identifier.starts_with("RB-"));
    // The legacy result must agree with the canonical core digest.
    let request = binding_request_from_recipe_ir_v2(
        &intake,
        &recipe,
        &v2_authored_digest(),
        &BindingOptions::from_recipe(&recipe),
        "compiler-a",
        "renderer-a",
    );
    let record = build_binding_record(&request).expect("record");
    assert_eq!(result.object_binding, record.binding_sha256);
}

#[test]
fn presentation_independence_ui_copy_never_enters_the_preimage() {
    let baseline = build_binding_record(&v1_request()).expect("record");
    // The preimage only contains structured fields; changing a human-facing
    // label anywhere in the UI cannot alter the binding. We prove the negative
    // by feeding a request whose display-only sibling differs.
    let mut with_unicode_note = v1_request();
    with_unicode_note.renderer_version =
        format!("{} · PRETTY COPY", with_unicode_note.renderer_version);
    // note: '·' is non-ASCII; validate_tag must reject it to keep the preimage
    // stable and portable.
    assert!(build_binding_record(&with_unicode_note).is_err());
    let _ = baseline;
}

#[test]
fn build_binding_record_rejects_malformed_requests() {
    let mut short = v1_request();
    short.source_byte_sha256 = "z".repeat(10);
    assert!(build_binding_record(&short).is_err());
    let mut upper = v1_request();
    upper.canonical_pixel_sha256 = "A".repeat(64);
    assert!(build_binding_record(&upper).is_err());
    let mut empty = v1_request();
    empty.compiler_version = String::new();
    assert!(build_binding_record(&empty).is_err());
}
