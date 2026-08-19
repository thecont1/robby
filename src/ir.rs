//! Lower a validated AST into the stable `robby-ir-v1` JSON model.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::ast::{Command, Script, Value};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Ir {
    pub version: String,
    pub canvas: Canvas,
    pub palette: Palette,
    pub reverse: Reverse,
    pub output: Output,
    pub meta: Meta,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Canvas {
    pub base: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Palette {
    pub k: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Reverse {
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Output {
    pub obverse: String,
    pub reverse: String,
    pub manifest: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Meta {
    pub script_sha256: String,
}

/// `lower` assumes `validator::validate` has already accepted this script.
pub(crate) fn lower(script: &Script, source: &str) -> Ir {
    let base = command(script, "base");
    let base_values = named(base);
    let base_path = base
        .arguments
        .iter()
        .find(|argument| argument.name.is_none())
        .and_then(|argument| argument.value.as_string())
        .expect("validated base path");
    let canvas = Canvas {
        base: base_path.to_string(),
        width: number(&base_values, "width").map(|value| value as u32),
        height: number(&base_values, "height").map(|value| value as u32),
    };
    let palette = script
        .commands
        .iter()
        .find(|command| command.name == "palette")
        .map(|command| Palette {
            k: number(&named(command), "k").unwrap_or(8.0) as u8,
        })
        .unwrap_or(Palette { k: 8 });
    let reverse = Reverse {
        mode: string(&named(command(script, "reverse")), "mode").to_string(),
    };
    let output_values = named(command(script, "output"));
    let output = Output {
        obverse: string(&output_values, "obverse").to_string(),
        reverse: string(&output_values, "reverse").to_string(),
        manifest: string(&output_values, "manifest").to_string(),
    };
    let script_sha256 = format!("{:x}", Sha256::digest(source.as_bytes()));
    Ir {
        version: "robby-ir-v1".to_string(),
        canvas,
        palette,
        reverse,
        output,
        meta: Meta { script_sha256 },
    }
}

fn command<'a>(script: &'a Script, name: &str) -> &'a Command {
    script
        .commands
        .iter()
        .find(|command| command.name == name)
        .expect("validated command")
}

fn named(command: &Command) -> HashMap<&str, &Value> {
    command
        .arguments
        .iter()
        .filter_map(|argument| argument.name.as_deref().map(|name| (name, &argument.value)))
        .collect()
}

fn string<'a>(values: &'a HashMap<&str, &Value>, key: &str) -> &'a str {
    values
        .get(key)
        .and_then(|value| value.as_string())
        .expect("validated string")
}

fn number(values: &HashMap<&str, &Value>, key: &str) -> Option<f64> {
    values.get(key).and_then(|value| value.as_number())
}
