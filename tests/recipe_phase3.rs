use robby_compiler::{compile_recipe_source, compile_source};

const RECIPE: &str = r#"
object "bangalore-night-001" {
  input "MS202308-Bangalore0739-Enhanced-NR.jpg"

  inspect {
    exif: read
    iptc: read
    xmp: read
    c2pa: verify
    gps: private
  }

  context {
    place: set "Bengaluru, India"
    time: set "2049-11-17T21:30:00+05:30"
    era: set "late platform capitalism"
    source_capture_time: retain observed
    source_gps: keep private
  }

  split palette {
    method: median_cut
    colours: 12
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

#[test]
fn parses_and_lowers_the_single_image_recipe() {
    let ir = compile_recipe_source(RECIPE).expect("recipe should compile");
    assert_eq!(ir.version, "robby-ir-v2");
    assert_eq!(ir.object.name, "bangalore-night-001");
    assert_eq!(ir.object.input, "MS202308-Bangalore0739-Enhanced-NR.jpg");
    assert_eq!(ir.split_palette.colours, 12);
    assert_eq!(ir.reverse.mode, "palette_grid");
    assert_eq!(ir.reverse.seed, "object_binding");
    assert_eq!(ir.recipe_sha256.len(), 64);
}

#[test]
fn formatting_only_changes_preserve_recipe_hash() {
    let compact = RECIPE.replace('\n', " ");
    assert_eq!(
        compile_recipe_source(RECIPE).unwrap().recipe_sha256,
        compile_recipe_source(&compact).unwrap().recipe_sha256
    );
}

#[test]
fn meaningful_recipe_parameters_change_recipe_hash() {
    let changed = RECIPE.replace("colours: 12", "colours: 13");
    assert_ne!(
        compile_recipe_source(RECIPE).unwrap().recipe_sha256,
        compile_recipe_source(&changed).unwrap().recipe_sha256
    );
}

#[test]
fn rejects_multiple_inputs_without_compositing() {
    let changed = RECIPE.replace(
        "input \"MS202308-Bangalore0739-Enhanced-NR.jpg\"",
        "input \"first.jpg\"\n  input \"second.jpg\"",
    );
    let error = compile_recipe_source(&changed).unwrap_err();
    assert!(error.message.contains("exactly one `input`"));
}

#[test]
fn rejects_unsupported_privacy_evidence_binding_and_seed_directives_explicitly() {
    for (needle, replacement, expected) in [
        (
            "source_gps: keep private",
            "source_gps: set public",
            "privacy directive",
        ),
        (
            "evidence: verified_public",
            "evidence: raw",
            "binding directive",
        ),
        ("compiler: version", "compiler: hash", "binding directive"),
        ("seed: object_binding", "seed: random", "seed source"),
    ] {
        let changed = RECIPE.replace(needle, replacement);
        let error = compile_recipe_source(&changed).unwrap_err();
        assert!(
            error.message.contains(expected),
            "{needle} should mention {expected}, got {}",
            error.message
        );
    }
}

#[test]
fn v1_scripts_keep_their_explicit_migration_boundary() {
    let v1 = r#"base("image.jpg")
reverse(mode: "negative")
output(obverse: "front.png", reverse: "transient", manifest: "transient")"#;
    assert_eq!(compile_source(v1).unwrap().version, "robby-ir-v1");
    assert!(compile_recipe_source(v1)
        .unwrap_err()
        .message
        .contains("object"));
}

#[test]
fn v1_scripts_accept_observability_sheet_as_a_development_reverse() {
    let source = r#"base("image.jpg")
palette(k: 8)
reverse(mode: "observability_sheet")
output(obverse: "front.png", reverse: "transient", manifest: "transient")"#;
    let ir = compile_source(source).expect("sheet script");
    assert_eq!(ir.reverse.mode, "observability_sheet");
}
