//! Lower a validated AST into the stable `robby-ir-v1` JSON model.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::ast::{Command, Script, Value};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Ir {
    pub version: String,
    pub canvas: Canvas,
    pub cutouts: Vec<Cutout>,
    pub layers: Vec<Layer>,
    pub palette: Option<Palette>,
    pub reverse: Vec<Reverse>,
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
pub struct Cutout {
    pub id: String,
    pub source: String,
    pub mask: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Layer {
    pub cutout: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub rotation: f64,
    pub opacity: f64,
    pub blend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Palette {
    pub k: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Reverse {
    pub mode: String,
    pub k: Option<u8>,
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

    let cutouts = script
        .commands
        .iter()
        .filter(|command| command.name == "cutout")
        .map(|command| {
            let values = named(command);
            Cutout {
                id: string(&values, "id").to_string(),
                source: string(&values, "source").to_string(),
                mask: string(&values, "mask").to_string(),
            }
        })
        .collect();

    let layers = script
        .commands
        .iter()
        .filter(|command| command.name == "place")
        .map(|command| {
            let values = named(command);
            Layer {
                cutout: string(&values, "cutout").to_string(),
                x: number(&values, "x").expect("validated x"),
                y: number(&values, "y").expect("validated y"),
                scale: number(&values, "scale").unwrap_or(1.0),
                rotation: number(&values, "rotation").unwrap_or(0.0),
                opacity: number(&values, "opacity").unwrap_or(1.0),
                blend: values
                    .get("blend")
                    .and_then(|value| value.as_string())
                    .unwrap_or("normal")
                    .to_string(),
            }
        })
        .collect();

    let palette = script.commands.iter().find(|command| command.name == "palette").map(|command| {
        let values = named(command);
        Palette {
            k: number(&values, "k").unwrap_or(6.0) as u8,
        }
    });

    let reverse = script
        .commands
        .iter()
        .filter(|command| command.name == "reverse")
        .map(|command| {
            let values = named(command);
            let mode = string(&values, "mode").to_string();
            let k = if mode == "palette-grid" {
                Some(number(&values, "k").unwrap_or_else(|| palette.as_ref().map_or(6, |item| item.k) as f64) as u8)
            } else {
                None
            };
            Reverse { mode, k }
        })
        .collect();

    let output_values = named(command(script, "output"));
    let output = Output {
        obverse: string(&output_values, "obverse").to_string(),
        reverse: string(&output_values, "reverse").to_string(),
        manifest: string(&output_values, "manifest").to_string(),
    };

    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    Ir {
        version: "robby-ir-v1".to_string(),
        canvas,
        cutouts,
        layers,
        palette,
        reverse,
        output,
        meta: Meta {
            script_sha256: format!("{:x}", hasher.finalize()),
        },
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
