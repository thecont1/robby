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
fn accepts_documented_evidence_alias_and_quoted_private_gps() {
    let documented = RECIPE
        .replace("inspect {", "evidence {")
        .replace("gps: private", "gps: \"private\"")
        .replace("method: median_cut", "method: \"median-cut\"")
        .replace("reverse palette_grid {", "reverse \"palette-grid\" {")
        .replace("arrange: seeded_shuffle", "arrange: \"seeded-shuffle\"")
        .replace("seed: object_binding", "seed: \"object-binding\"")
        .replace("border: source_palette", "border: \"source-palette\"")
        .replace("gps: remove", "gps: \"remove\"")
        .replace("c2pa: summary", "c2pa: \"summary\"")
        .replace("manifest: public_safe", "manifest: \"public-safe\"");
    let ir = compile_recipe_source(&documented).expect("documented recipe should compile");
    assert_eq!(ir.inspect.get("gps").map(String::as_str), Some("private"));
    assert_eq!(ir.reverse.mode, "palette_grid");
    assert_eq!(ir.reverse.seed, "object-binding");
    assert_eq!(ir.publish.get("gps").map(String::as_str), Some("remove"));
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

#[test]
fn v2_negative_reverse_is_accepted_with_default_palette_directives() {
    let source = RECIPE.replace("reverse palette_grid {", "reverse negative {")
        .replace("    cell: 10\n    arrange: seeded_shuffle\n    seed: object_binding\n    border: source_palette", "    palette: active\n    dither: none");
    compile_recipe_source(&source).expect("v2 negative reverse");
}

#[test]
fn rejects_duplicate_and_surplus_authored_keys() {
    // Duplicates previously overwrote silently via the HashMap collect.
    let duplicate_palette = RECIPE.replace("colours: 12", "colours: 12\n    colours: 9");
    let error = compile_recipe_source(&duplicate_palette).unwrap_err();
    assert!(
        error.message.contains("Duplicate"),
        "duplicate palette key should be rejected, got {}",
        error.message
    );

    let duplicate_reverse = RECIPE.replace("cell: 10", "cell: 10\n    cell: 12");
    let error = compile_recipe_source(&duplicate_reverse).unwrap_err();
    assert!(
        error.message.contains("Duplicate"),
        "duplicate reverse key should be rejected, got {}",
        error.message
    );

    // Surplus keys were previously ignored rather than rejected.
    let surplus = RECIPE.replace("cell: 10", "cell: 10\n    tilt: 3");
    let error = compile_recipe_source(&surplus).unwrap_err();
    assert!(
        error.message.contains("Unsupported reverse directive"),
        "surplus reverse key should be rejected, got {}",
        error.message
    );
}

#[test]
fn rejects_out_of_range_and_non_integer_palette_grid_cells() {
    for bad in ["cell: 0", "cell: -4", "cell: 2.5", "cell: 100000"] {
        let changed = RECIPE.replace("cell: 10", bad);
        let error = compile_recipe_source(&changed).unwrap_err();
        assert!(
            error.message.contains("between 1 and 4096"),
            "{bad} should be rejected by range validation, got {}",
            error.message
        );
    }
    // A valid boundary value still compiles.
    assert!(compile_recipe_source(&RECIPE.replace("cell: 10", "cell: 4096")).is_ok());
    assert!(compile_recipe_source(&RECIPE.replace("cell: 10", "cell: 1")).is_ok());
}

#[test]
fn rejects_calls_with_wrong_arity_or_argument_values() {
    // `bands`/`grid` require the documented call for each measure and the
    // exact supported value—not merely any positive numeric argument.
    for (needle, bad) in [
        ("luminance: bands(8)", "luminance: bands()"),
        ("luminance: bands(8)", "luminance: bands(8, 9)"),
        ("luminance: bands(8)", "luminance: bands(0)"),
        ("luminance: bands(8)", "luminance: bands(7)"),
        ("luminance: bands(8)", "luminance: grid(24)"),
        ("texture: grid(24)", "texture: bands(8)"),
        ("texture: grid(24)", "texture: grid(25)"),
    ] {
        let changed = RECIPE.replace(needle, bad);
        assert!(
            compile_recipe_source(&changed).is_err(),
            "{bad} should be rejected"
        );
    }
    // The documented privacy forms keep working.
    assert!(compile_recipe_source(RECIPE).is_ok());
    // But a wrong argument value to the same call name does not.
    let wrong_argument = RECIPE.replace(
        "source_capture_time: retain observed",
        "source_capture_time: retain guessed",
    );
    assert!(
        compile_recipe_source(&wrong_argument).is_err(),
        "`retain guessed` should be rejected"
    );
}
