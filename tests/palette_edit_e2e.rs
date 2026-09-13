//! End-to-end check for the QA report "Palette change leaves recipe text stale".
//! The UI rewrites the authored recipe text when the palette control changes;
//! this asserts the REAL compiler lowers that rewritten text to the new k,
//! so the editor text, the control, and the compiled IR cannot disagree.
use robby_compiler::compile_source;

const SCRIPT: &str = "base(\"render-source.jpg\")\npalette(k: 8)\nreverse(mode: \"negative\")\noutput(obverse: \"source.jpg\", reverse: \"transient\", manifest: \"transient\")";

#[test]
fn authored_text_after_palette_edit_lowers_to_new_k() {
    let original = compile_source(SCRIPT).expect("baseline recipe compiles");
    assert_eq!(original.palette.k, 8u8);

    // Exactly what the UI's replacePaletteK produces for 8 -> 5.
    let edited = SCRIPT.replace("palette(k: 8)", "palette(k: 5)");
    let ir = compile_source(&edited).expect("edited recipe compiles");
    assert_eq!(
        ir.palette.k, 5u8,
        "compiled IR must match the visible authored text"
    );
    assert!(edited.contains("palette(k: 5)"));
    assert!(!edited.contains("palette(k: 8)"));
}

#[test]
fn palette_bounds_are_enforced_by_the_compiler() {
    for k in [3u8, 16] {
        let src = SCRIPT.replace("palette(k: 8)", &format!("palette(k: {k})"));
        assert_eq!(
            compile_source(&src).expect("in-range k compiles").palette.k,
            k
        );
    }
    for k in ["2", "17"] {
        let src = SCRIPT.replace("palette(k: 8)", &format!("palette(k: {k})"));
        assert!(compile_source(&src).is_err(), "k={k} must be rejected");
    }
}
