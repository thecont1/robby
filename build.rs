use std::env;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let rustc = env::var("RUSTC").unwrap_or_else(|_| "rustc".to_string());
    let toolchain_label = Command::new(rustc)
        .arg("--version")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|version| version.split_whitespace().nth(1).map(str::to_owned))
        .map(|version| format!("RUST {version}"))
        .unwrap_or_else(|| "RUST UNKNOWN".to_string());

    println!("cargo:rustc-env=ROBBY_RUST_TOOLCHAIN={toolchain_label}");
}
