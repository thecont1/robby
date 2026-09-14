//! Lower validated programs into stable versioned IR models.

use std::collections::{BTreeMap, HashMap};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sha2::{Digest, Sha256};

use crate::ast::{Clause, Command, Recipe, Script, Value};

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecipeIr {
    pub version: String,
    pub object: RecipeObject,
    pub inspect: BTreeMap<String, String>,
    pub context: BTreeMap<String, JsonValue>,
    pub split_palette: PaletteSplit,
    pub measure: BTreeMap<String, JsonValue>,
    pub bind: BTreeMap<String, String>,
    pub reverse: RecipeReverse,
    pub publish: BTreeMap<String, String>,
    pub recipe_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecipeObject {
    pub name: String,
    pub input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PaletteSplit {
    pub method: String,
    pub colours: u8,
    pub order: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecipeReverse {
    pub mode: String,
    pub cell: u32,
    pub arrange: String,
    pub seed: String,
    pub border: String,
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

/// Rust-defined canonical serialization of a validated/lowered v1 IR.
///
/// This is the canonical v1 recipe identity: a stable, versioned encoding of
/// the typed IR that is independent of authored formatting, UI property
/// order, or JavaScript object layout. `build_binding_record` hashes these
/// bytes as `canonicalRecipeSha256` (Plan 9 / ADR-003 / P9A.3).
///
/// Encoding: NUL-separated `key=value` lines over the lowered semantic
/// content, anchored by the schema tag.
pub fn canonical_v1_recipe_bytes(ir: &Ir) -> String {
    [
        format!("schema={}", ir.version),
        format!("canvas.base={}", ir.canvas.base),
        match ir.canvas.width {
            Some(width) => format!("canvas.width={width}"),
            None => "canvas.width=".to_string(),
        },
        match ir.canvas.height {
            Some(height) => format!("canvas.height={height}"),
            None => "canvas.height=".to_string(),
        },
        format!("palette.k={}", ir.palette.k),
        format!("reverse.mode={}", ir.reverse.mode),
        format!("output.obverse={}", ir.output.obverse),
        format!("output.reverse={}", ir.output.reverse),
        format!("output.manifest={}", ir.output.manifest),
    ]
    .join("\u{0}")
}

pub(crate) fn lower_recipe(recipe: &Recipe) -> RecipeIr {
    let object = &recipe.object;
    let input = clause(object, "input")
        .arguments
        .first()
        .and_then(|argument| argument.value.as_string())
        .expect("validated input");
    let inspect = string_entries(clause(object, "inspect"));
    let context = json_entries(clause(object, "context"));
    let split = clause(object, "split");
    let split_entries = json_entries(split);
    let split_palette = PaletteSplit {
        method: string_json(&split_entries, "method"),
        colours: number_json(&split_entries, "colours") as u8,
        order: string_json(&split_entries, "order"),
    };
    let measure = json_entries(clause(object, "measure"));
    let bind = string_entries(clause(object, "bind"));
    let reverse_clause = clause(object, "reverse");
    let reverse_entries = json_entries(reverse_clause);
    let reverse = RecipeReverse {
        mode: reverse_clause
            .variant
            .clone()
            .expect("validated reverse mode"),
        cell: optional_number_json(&reverse_entries, "cell") as u32,
        arrange: optional_string_json(&reverse_entries, "arrange"),
        seed: optional_string_json(&reverse_entries, "seed"),
        border: optional_string_json(&reverse_entries, "border"),
    };
    let publish = string_entries(clause(object, "publish"));
    let mut result = RecipeIr {
        version: "robby-ir-v2".to_string(),
        object: RecipeObject {
            name: object.name.clone(),
            input: input.to_string(),
        },
        inspect,
        context,
        split_palette,
        measure,
        bind,
        reverse,
        publish,
        recipe_sha256: String::new(),
    };
    result.recipe_sha256 = canonical_hash(&result);
    result
}

/// Serialize semantic IR with recursively sorted object keys; source whitespace is absent.
pub fn canonical_recipe_json(ir: &RecipeIr) -> String {
    let mut value = serde_json::to_value(ir).expect("recipe IR serializes");
    if let JsonValue::Object(ref mut object) = value {
        object.remove("recipe_sha256");
    }
    serde_json::to_string(&sort_json(value)).expect("canonical recipe IR serializes")
}

pub fn canonical_hash(ir: &RecipeIr) -> String {
    format!("{:x}", Sha256::digest(canonical_recipe_json(ir).as_bytes()))
}

fn sort_json(value: JsonValue) -> JsonValue {
    match value {
        JsonValue::Object(object) => JsonValue::Object(
            object
                .into_iter()
                .map(|(key, value)| (key, sort_json(value)))
                .collect::<serde_json::Map<_, _>>(),
        ),
        JsonValue::Array(values) => JsonValue::Array(values.into_iter().map(sort_json).collect()),
        other => other,
    }
}

fn clause<'a>(recipe: &'a crate::ast::Object, name: &str) -> &'a Clause {
    recipe
        .clauses
        .iter()
        .find(|clause| clause.name == name)
        .expect("validated clause")
}

fn string_entries(clause: &Clause) -> BTreeMap<String, String> {
    clause
        .entries
        .iter()
        .filter_map(|entry| {
            value_string(&entry.value).map(|value| (entry.name.clone().unwrap(), value.to_string()))
        })
        .collect()
}

fn json_entries(clause: &Clause) -> BTreeMap<String, JsonValue> {
    clause
        .entries
        .iter()
        .map(|entry| (entry.name.clone().unwrap(), json_value(&entry.value)))
        .collect()
}

fn json_value(value: &Value) -> JsonValue {
    match value {
        Value::String(value) | Value::Identifier(value) => JsonValue::String(value.clone()),
        Value::Number(value) => json!(value),
        Value::Call { name, arguments } => {
            json!({ "name": name, "arguments": arguments.iter().map(json_value).collect::<Vec<_>>() })
        }
    }
}

fn value_string(value: &Value) -> Option<&str> {
    match value {
        Value::String(value) | Value::Identifier(value) => Some(value),
        _ => None,
    }
}

fn string_json(values: &BTreeMap<String, JsonValue>, key: &str) -> String {
    values
        .get(key)
        .and_then(JsonValue::as_str)
        .expect("validated string")
        .to_string()
}

fn optional_string_json(values: &BTreeMap<String, JsonValue>, key: &str) -> String {
    values
        .get(key)
        .and_then(JsonValue::as_str)
        .unwrap_or("")
        .to_string()
}

fn number_json(values: &BTreeMap<String, JsonValue>, key: &str) -> f64 {
    values
        .get(key)
        .and_then(JsonValue::as_f64)
        .expect("validated number")
}

fn optional_number_json(values: &BTreeMap<String, JsonValue>, key: &str) -> f64 {
    values.get(key).and_then(JsonValue::as_f64).unwrap_or(0.0)
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
