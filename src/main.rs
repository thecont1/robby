//! Native CLI adapter for the portable `robby-compiler` library.

use std::env;
use std::fs;
use std::path::PathBuf;

use robby_compiler::{compile_source, COMPILER_VERSION};

fn usage() {
    eprintln!(
        "{COMPILER_VERSION}\n\nUsage:\n  robby compile <script.robby> --out <ir.json>\n  robby check <script.robby>\n  robby version"
    );
}

fn main() {
    let arguments: Vec<String> = env::args().skip(1).collect();
    if arguments.first().is_some_and(|argument| argument == "version") {
        println!("{COMPILER_VERSION}");
        return;
    }
    let (script_path, output_path) = match arguments.as_slice() {
        [command, script] if command == "check" => (script, None),
        [command, script, flag, output] if command == "compile" && flag == "--out" => (script, Some(PathBuf::from(output))),
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
                eprintln!("Error: Could not write `{}`: {error}", output_path.display());
                std::process::exit(1);
            }
            println!("Compiled `{script_path}` → `{}`", output_path.display());
        }
    }
}
