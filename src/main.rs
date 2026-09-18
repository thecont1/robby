//! Native CLI adapter for the portable `troid` compiler engine.

use std::env;
use std::fs;
use std::io::Write;
use std::path::PathBuf;

use robby_compiler::build_binding_json;
use robby_compiler::inspect_image_json;
use robby_compiler::render::{render_reverse, RenderSettings};
use robby_compiler::{analyze_ingredients_json, compile_source, COMPILER_VERSION};

fn usage() {
    eprintln!(
        "{COMPILER_VERSION}\n\nUsage (troid engine; `robby` remains a compatibility alias):\n  troid compile <script.robby> --out <ir.json>\n  troid check <script.robby>\n  troid render <source-image> --settings <json>\n  troid inspect <source-image> <original-name>\n  troid ingredients <source-image> --k <3..64>\n  troid bind <binding-request.json>\n  troid version"
    );
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    if arguments
        .first()
        .is_some_and(|argument| argument == "version")
    {
        println!("{COMPILER_VERSION}");
        return;
    }
    if let [command, source_path, flag, settings_json] = arguments.as_slice() {
        if command == "render" && flag == "--settings" {
            let source_bytes = fs::read(source_path).unwrap_or_else(|error| {
                eprintln!("Error: Could not read `{source_path}`: {error}");
                std::process::exit(1);
            });
            let settings: RenderSettings =
                serde_json::from_str(settings_json).unwrap_or_else(|error| {
                    eprintln!("Error: Invalid render settings: {error}");
                    std::process::exit(1);
                });
            let result = render_reverse(&source_bytes, &settings).unwrap_or_else(|error| {
                eprintln!("Error: {error}");
                std::process::exit(1);
            });
            let manifest = serde_json::to_string(&result.manifest).expect("manifest serializes");
            eprintln!("ROBBY_MANIFEST:{manifest}");
            std::io::stdout()
                .write_all(&result.png)
                .unwrap_or_else(|error| {
                    eprintln!("Error: Could not stream reverse PNG: {error}");
                    std::process::exit(1);
                });
            return;
        }
    }
    if let [command, source_path, original_name] = arguments.as_slice() {
        if command == "inspect" {
            let source_bytes = fs::read(source_path).unwrap_or_else(|error| {
                eprintln!("Error: Could not read `{source_path}`: {error}");
                std::process::exit(1);
            });
            let manifest =
                inspect_image_json(original_name, &source_bytes).unwrap_or_else(|error| {
                    eprintln!("Error: {error}");
                    std::process::exit(1);
                });
            println!("{manifest}");
            return;
        }
    }
    if let [command, source_path, flag, k] = arguments.as_slice() {
        if command == "ingredients" && flag == "--k" {
            let source_bytes = fs::read(source_path).unwrap_or_else(|error| {
                eprintln!("Error: Could not read `{source_path}`: {error}");
                std::process::exit(1);
            });
            let palette_k = k.parse::<u8>().unwrap_or_else(|_| {
                eprintln!("Error: palette k must be an integer between 3 and 64");
                std::process::exit(1);
            });
            let analysis = analyze_ingredients_json(&source_bytes, palette_k).unwrap_or_else(|error| {
                eprintln!("Error: {error}");
                std::process::exit(1);
            });
            println!("{analysis}");
            return;
        }
    }
    if let [command, request_path] = arguments.as_slice() {
        if command == "bind" {
            let request_json = fs::read_to_string(request_path).unwrap_or_else(|error| {
                eprintln!("Error: Could not read `{request_path}`: {error}");
                std::process::exit(1);
            });
            let record = build_binding_json(&request_json).unwrap_or_else(|error| {
                eprintln!("Error: {error}");
                std::process::exit(1);
            });
            println!("{record}");
            return;
        }
    }
    let (script_path, output_path) = match arguments.as_slice() {
        [command, script] if command == "check" => (script, None),
        [command, script, flag, output] if command == "compile" && flag == "--out" => {
            (script, Some(PathBuf::from(output)))
        }
        _ => {
            usage();
            std::process::exit(2);
        }
    };
    let source = match fs::read_to_string(script_path) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("Error: Could not read `{script_path}`: {error}");
            std::process::exit(1);
        }
    };
    let ir = match compile_source(&source) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };

    match output_path {
        None => println!("Valid Robby v1 script: `{script_path}`"),
        Some(output_path) => {
            if let Some(parent) = output_path.parent() {
                if let Err(error) = fs::create_dir_all(parent) {
                    eprintln!("Error: Could not create `{}`: {error}", parent.display());
                    std::process::exit(1);
                }
            }
            let json = serde_json::to_string_pretty(&ir).expect("IR should always serialize");
            if let Err(error) = fs::write(&output_path, format!("{json}\n")) {
                eprintln!(
                    "Error: Could not write `{}`: {error}",
                    output_path.display()
                );
                std::process::exit(1);
            }
            println!("Compiled `{script_path}` → `{}`", output_path.display());
        }
    }
}
