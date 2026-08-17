//! Robby v1 compiler core.
//!
//! The compiler has deliberately visible stages: it parses source text into a
//! tiny AST, validates author-facing rules, and lowers the result to JSON IR.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fmt::{self, Display};
use std::fs;
use std::path::Path;

type CompileResult<T> = Result<T, CompilerError>;

#[derive(Debug, Clone)]
struct CompilerError {
    line: Option<usize>,
    message: String,
}

impl CompilerError {
    fn at(line: usize, message: impl Into<String>) -> Self {
        Self {
            line: Some(line),
            message: message.into(),
        }
    }

    fn plain(message: impl Into<String>) -> Self {
        Self {
            line: None,
            message: message.into(),
        }
    }
}

impl Display for CompilerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.line {
            Some(line) => write!(f, "Error on line {line}: {}", self.message),
            None => write!(f, "Error: {}", self.message),
        }
    }
}

#[derive(Debug, Clone)]
enum Value {
    String(String),
    Number(f64),
    Identifier(String),
}

impl Value {
    fn type_name(&self) -> &'static str {
        match self {
            Value::String(_) => "a string",
            Value::Number(_) => "a number",
            Value::Identifier(_) => "an identifier",
        }
    }
}

#[derive(Debug, Clone)]
struct Argument {
    name: Option<String>,
    value: Value,
}

#[derive(Debug, Clone)]
struct Command {
    name: String,
    arguments: Vec<Argument>,
    line: usize,
}

#[derive(Debug, Serialize)]
struct Ir {
    version: String,
    canvas: Canvas,
    cutouts: Vec<Cutout>,
    layers: Vec<Layer>,
    palette: Option<Palette>,
    reverse: Vec<Reverse>,
    output: Output,
    meta: Meta,
}

#[derive(Debug, Serialize)]
struct Canvas {
    base: String,
    width: Option<u32>,
    height: Option<u32>,
}

#[derive(Debug, Serialize)]
struct Cutout {
    id: String,
    source: String,
    mask: String,
}

#[derive(Debug, Serialize)]
struct Layer {
    cutout: String,
    x: f64,
    y: f64,
    scale: f64,
    rotation: f64,
    opacity: f64,
    blend: String,
}

#[derive(Debug, Serialize)]
struct Palette {
    k: u8,
}

#[derive(Debug, Serialize)]
struct Reverse {
    mode: String,
    k: Option<u8>,
}

#[derive(Debug, Serialize)]
struct Output {
    obverse: String,
    reverse: String,
    manifest: String,
}

#[derive(Debug, Serialize)]
struct Meta {
    script_sha256: String,
}

fn strip_comment(line: &str) -> &str {
    let mut quote: Option<char> = None;
    let mut escaped = false;
    for (index, character) in line.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' && quote.is_some() {
            escaped = true;
            continue;
        }
        if character == '"' || character == '\'' {
            if quote == Some(character) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(character);
            }
        }
        if character == '#' && quote.is_none() {
            return &line[..index];
        }
    }
    line
}

fn split_top_level(input: &str, delimiter: char, line: usize) -> CompileResult<Vec<String>> {
    let mut pieces = Vec::new();
    let mut start = 0;
    let mut quote: Option<char> = None;
    let mut escaped = false;

    for (index, character) in input.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' && quote.is_some() {
            escaped = true;
            continue;
        }
        if character == '"' || character == '\'' {
            if quote == Some(character) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(character);
            }
        } else if character == delimiter && quote.is_none() {
            pieces.push(input[start..index].trim().to_string());
            start = index + character.len_utf8();
        }
    }
    if quote.is_some() {
        return Err(CompilerError::at(line, "Unterminated string literal."));
    }
    pieces.push(input[start..].trim().to_string());
    Ok(pieces)
}

fn find_top_level(input: &str, needle: char) -> Option<usize> {
    let mut quote: Option<char> = None;
    let mut escaped = false;
    for (index, character) in input.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' && quote.is_some() {
            escaped = true;
            continue;
        }
        if character == '"' || character == '\'' {
            if quote == Some(character) {
                quote = None;
            } else if quote.is_none() {
                quote = Some(character);
            }
        } else if character == needle && quote.is_none() {
            return Some(index);
        }
    }
    None
}

fn parse_value(raw: &str, line: usize) -> CompileResult<Value> {
    let value = raw.trim();
    if value.is_empty() {
        return Err(CompilerError::at(line, "Expected a value after `:`."));
    }
    if let Some(first) = value.chars().next() {
        if first == '"' || first == '\'' {
            if value.len() < 2 || !value.ends_with(first) {
                return Err(CompilerError::at(line, "Unterminated string literal."));
            }
            let inner = &value[1..value.len() - 1];
            return Ok(Value::String(inner.replace("\\\"", "\"").replace("\\'", "'")));
        }
    }
    if let Ok(number) = value.parse::<f64>() {
        if !number.is_finite() {
            return Err(CompilerError::at(line, "Numbers must be finite."));
        }
        return Ok(Value::Number(number));
    }
    if value.chars().all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '-') {
        return Ok(Value::Identifier(value.to_string()));
    }
    Err(CompilerError::at(
        line,
        format!("Could not parse `{value}`. Strings must be quoted."),
    ))
}

fn parse_arguments(raw: &str, line: usize) -> CompileResult<Vec<Argument>> {
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }
    split_top_level(raw, ',', line)?
        .into_iter()
        .map(|piece| {
            if piece.is_empty() {
                return Err(CompilerError::at(line, "Empty argument between commas."));
            }
            if let Some(colon) = find_top_level(&piece, ':') {
                let name = piece[..colon].trim();
                if name.is_empty()
                    || !name
                        .chars()
                        .all(|character| character.is_ascii_alphanumeric() || character == '_')
                {
                    return Err(CompilerError::at(line, "Argument names must be simple identifiers."));
                }
                Ok(Argument {
                    name: Some(name.to_string()),
                    value: parse_value(&piece[colon + 1..], line)?,
                })
            } else {
                Ok(Argument {
                    name: None,
                    value: parse_value(&piece, line)?,
                })
            }
        })
        .collect()
}

fn parse_script(script: &str) -> CompileResult<Vec<Command>> {
    let mut commands = Vec::new();
    for (index, original) in script.lines().enumerate() {
        let line = index + 1;
        let source = strip_comment(original).trim();
        if source.is_empty() {
            continue;
        }
        let Some(open) = source.find('(') else {
            return Err(CompilerError::at(line, "Expected `command(...)`."));
        };
        if !source.ends_with(')') {
            return Err(CompilerError::at(line, "Expected a closing `)` for this command."));
        }
        let name = source[..open].trim();
        if name.is_empty()
            || !name
                .chars()
                .all(|character| character.is_ascii_alphabetic() || character == '_')
        {
            return Err(CompilerError::at(line, "Command names must be alphabetic identifiers."));
        }
        commands.push(Command {
            name: name.to_string(),
            arguments: parse_arguments(&source[open + 1..source.len() - 1], line)?,
            line,
        });
    }
    Ok(commands)
}

fn named_arguments(command: &Command, allowed: &[&str]) -> CompileResult<HashMap<String, Value>> {
    let mut values = HashMap::new();
    for argument in &command.arguments {
        let Some(name) = &argument.name else {
            return Err(CompilerError::at(
                command.line,
                format!("`{}` does not accept positional arguments.", command.name),
            ));
        };
        if !allowed.contains(&name.as_str()) {
            return Err(CompilerError::at(
                command.line,
                format!("Unknown argument `{name}` for `{}`.", command.name),
            ));
        }
        if values.insert(name.clone(), argument.value.clone()).is_some() {
            return Err(CompilerError::at(
                command.line,
                format!("Argument `{name}` is declared more than once."),
            ));
        }
    }
    Ok(values)
}

fn required_string(values: &HashMap<String, Value>, key: &str, line: usize) -> CompileResult<String> {
    match values.get(key) {
        Some(Value::String(value)) => Ok(value.clone()),
        Some(value) => Err(CompilerError::at(
            line,
            format!("`{key}` must be a string, but received {}.", value.type_name()),
        )),
        None => Err(CompilerError::at(line, format!("Missing required `{key}` argument."))),
    }
}

fn optional_number(values: &HashMap<String, Value>, key: &str, default: f64, line: usize) -> CompileResult<f64> {
    match values.get(key) {
        Some(Value::Number(value)) => Ok(*value),
        Some(value) => Err(CompilerError::at(
            line,
            format!("`{key}` must be a number, but received {}.", value.type_name()),
        )),
        None => Ok(default),
    }
}

fn optional_integer(values: &HashMap<String, Value>, key: &str, line: usize) -> CompileResult<Option<u32>> {
    match values.get(key) {
        Some(Value::Number(value)) if *value > 0.0 && value.fract() == 0.0 && *value <= u32::MAX as f64 => {
            Ok(Some(*value as u32))
        }
        Some(Value::Number(_)) => Err(CompilerError::at(
            line,
            format!("`{key}` must be a positive integer."),
        )),
        Some(value) => Err(CompilerError::at(
            line,
            format!("`{key}` must be a number, but received {}.", value.type_name()),
        )),
        None => Ok(None),
    }
}

fn palette_k(values: &HashMap<String, Value>, key: &str, default: u8, line: usize) -> CompileResult<u8> {
    let Some(value) = values.get(key) else {
        return Ok(default);
    };
    match value {
        Value::Number(number) if *number >= 3.0 && *number <= 16.0 && number.fract() == 0.0 => Ok(*number as u8),
        Value::Number(_) => Err(CompilerError::at(
            line,
            format!("`{key}` must be an integer between 3 and 16."),
        )),
        other => Err(CompilerError::at(
            line,
            format!("`{key}` must be a number, but received {}.", other.type_name()),
        )),
    }
}

fn compile(script: &str) -> CompileResult<Ir> {
    let commands = parse_script(script)?;
    if commands.is_empty() {
        return Err(CompilerError::plain(
            "Missing `base` command – every script must start with exactly one `base(...)`.",
        ));
    }
    if commands[0].name != "base" {
        return Err(CompilerError::at(
            commands[0].line,
            "Missing `base` command – every script must start with exactly one `base(...)`.",
        ));
    }

    let mut canvas: Option<Canvas> = None;
    let mut cutouts: Vec<Cutout> = Vec::new();
    let mut seen_cutouts = HashSet::new();
    let mut layers: Vec<Layer> = Vec::new();
    let mut palette: Option<Palette> = None;
    let mut reverse: Vec<Reverse> = Vec::new();
    let mut output: Option<Output> = None;

    for (index, command) in commands.iter().enumerate() {
        match command.name.as_str() {
            "base" => {
                if index != 0 || canvas.is_some() {
                    return Err(CompilerError::at(
                        command.line,
                        "Exactly one `base(...)` command is allowed, and it must be first.",
                    ));
                }
                let mut positional = command.arguments.iter().filter(|argument| argument.name.is_none());
                let path = match positional.next() {
                    Some(Argument {
                        value: Value::String(path),
                        ..
                    }) => path.clone(),
                    Some(argument) => {
                        return Err(CompilerError::at(
                            command.line,
                            format!("The base path must be a string, but received {}.", argument.value.type_name()),
                        ))
                    }
                    None => {
                        return Err(CompilerError::at(
                            command.line,
                            "Missing base image path. Use `base(\"image.jpg\")`.",
                        ))
                    }
                };
                if positional.next().is_some() {
                    return Err(CompilerError::at(command.line, "`base(...)` accepts only one positional path."));
                }
                let mut values = HashMap::new();
                for argument in &command.arguments {
                    if let Some(name) = &argument.name {
                        if !["width", "height"].contains(&name.as_str()) {
                            return Err(CompilerError::at(command.line, format!("Unknown argument `{name}` for `base`.")));
                        }
                        if values.insert(name.clone(), argument.value.clone()).is_some() {
                            return Err(CompilerError::at(command.line, format!("Argument `{name}` is declared more than once.")));
                        }
                    }
                }
                canvas = Some(Canvas {
                    base: path,
                    width: optional_integer(&values, "width", command.line)?,
                    height: optional_integer(&values, "height", command.line)?,
                });
            }
            "cutout" => {
                let values = named_arguments(command, &["source", "mask", "id"])?;
                let id = required_string(&values, "id", command.line)?;
                if !seen_cutouts.insert(id.clone()) {
                    return Err(CompilerError::at(command.line, format!("Cutout id `{id}` is already declared.")));
                }
                let mask = required_string(&values, "mask", command.line)?;
                if !["person", "sky"].contains(&mask.as_str()) {
                    return Err(CompilerError::at(
                        command.line,
                        format!("Unknown mask type `{mask}`. v1 supports `person` and `sky`."),
                    ));
                }
                cutouts.push(Cutout {
                    id,
                    source: required_string(&values, "source", command.line)?,
                    mask,
                });
            }
            "place" => {
                let values = named_arguments(command, &["cutout", "x", "y", "scale", "rotation", "opacity", "blend"])?;
                let cutout = required_string(&values, "cutout", command.line)?;
                if !seen_cutouts.contains(&cutout) {
                    return Err(CompilerError::at(
                        command.line,
                        format!("Unknown cutout `{cutout}`. Declare it with `cutout(...)` before placing it."),
                    ));
                }
                let x = optional_number(&values, "x", f64::NAN, command.line)?;
                let y = optional_number(&values, "y", f64::NAN, command.line)?;
                if !x.is_finite() || !y.is_finite() {
                    return Err(CompilerError::at(command.line, "`place(...)` requires both normalized `x` and `y` coordinates."));
                }
                if !(0.0..=1.0).contains(&x) || !(0.0..=1.0).contains(&y) {
                    return Err(CompilerError::at(command.line, "`x` and `y` must be normalized coordinates from 0.0 to 1.0."));
                }
                let scale = optional_number(&values, "scale", 1.0, command.line)?;
                if scale <= 0.0 {
                    return Err(CompilerError::at(command.line, "`scale` must be greater than 0."));
                }
                let opacity = optional_number(&values, "opacity", 1.0, command.line)?;
                if !(0.0..=1.0).contains(&opacity) {
                    return Err(CompilerError::at(command.line, "`opacity` must be between 0.0 and 1.0."));
                }
                let rotation = optional_number(&values, "rotation", 0.0, command.line)?;
                let blend = match values.get("blend") {
                    Some(Value::String(value)) => value.clone(),
                    Some(other) => return Err(CompilerError::at(command.line, format!("`blend` must be a string, but received {}.", other.type_name()))),
                    None => "normal".to_string(),
                };
                if !["normal", "multiply", "screen", "overlay"].contains(&blend.as_str()) {
                    return Err(CompilerError::at(
                        command.line,
                        format!("Unknown blend mode `{blend}`. v1 supports `normal`, `multiply`, `screen`, and `overlay`."),
                    ));
                }
                layers.push(Layer { cutout, x, y, scale, rotation, opacity, blend });
            }
            "palette" => {
                if palette.is_some() {
                    return Err(CompilerError::at(command.line, "Only one `palette(...)` command is allowed."));
                }
                let values = named_arguments(command, &["k"])?;
                palette = Some(Palette { k: palette_k(&values, "k", 6, command.line)? });
            }
            "reverse" => {
                if reverse.len() == 2 {
                    return Err(CompilerError::at(command.line, "v1 supports at most two reverse modes."));
                }
                let values = named_arguments(command, &["mode", "k"])?;
                let mode = required_string(&values, "mode", command.line)?;
                if !["provenance-map", "palette-grid"].contains(&mode.as_str()) {
                    return Err(CompilerError::at(command.line, format!("Unknown reverse mode `{mode}`. v1 supports `provenance-map` and `palette-grid`.")));
                }
                let k = match mode.as_str() {
                    "palette-grid" => Some(palette_k(&values, "k", palette.as_ref().map_or(6, |item| item.k), command.line)?),
                    _ if values.contains_key("k") => return Err(CompilerError::at(command.line, "`k` is only valid for `reverse(mode: \"palette-grid\")`.")),
                    _ => None,
                };
                reverse.push(Reverse { mode, k });
            }
            "output" => {
                if output.is_some() {
                    return Err(CompilerError::at(command.line, "Only one `output(...)` command is allowed."));
                }
                if index != commands.len() - 1 {
                    return Err(CompilerError::at(command.line, "`output(...)` must be the final command so the script reads in execution order."));
                }
                let values = named_arguments(command, &["obverse", "reverse", "manifest"])?;
                output = Some(Output {
                    obverse: required_string(&values, "obverse", command.line)?,
                    reverse: required_string(&values, "reverse", command.line)?,
                    manifest: required_string(&values, "manifest", command.line)?,
                });
            }
            other => return Err(CompilerError::at(command.line, format!("Unknown command `{other}`. v1 commands are `base`, `cutout`, `place`, `palette`, `reverse`, and `output`."))),
        }
    }

    let canvas = canvas.ok_or_else(|| CompilerError::plain("Missing `base` command – every script must start with exactly one `base(...)`."))?;
    if reverse.is_empty() {
        return Err(CompilerError::plain("Missing `reverse(...)` command – every composition needs an inspectable reverse image."));
    }
    let output = output.ok_or_else(|| CompilerError::plain("Missing `output(...)` command – declare obverse, reverse, and manifest filenames."))?;
    let mut hasher = Sha256::new();
    hasher.update(script.as_bytes());

    Ok(Ir {
        version: "robby-ir-v1".to_string(),
        canvas,
        cutouts,
        layers,
        palette,
        reverse,
        output,
        meta: Meta { script_sha256: format!("{:x}", hasher.finalize()) },
    })
}

fn usage() {
    eprintln!("Usage:\n  robby compile <script.robby> --out <ir.json>\n  robby check <script.robby>");
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        usage();
        std::process::exit(2);
    }
    let command = &args[0];
    let Some(script_path) = args.get(1) else {
        usage();
        std::process::exit(2);
    };
    let source = match fs::read_to_string(script_path) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("Error: Could not read `{script_path}`: {error}");
            std::process::exit(1);
        }
    };
    let ir = match compile(&source) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };
    match command.as_str() {
        "check" => println!("Valid Robby v1 script: `{script_path}`"),
        "compile" => {
            if args.len() != 4 || args[2] != "--out" {
                usage();
                std::process::exit(2);
            }
            let output_path = Path::new(&args[3]);
            if let Some(parent) = output_path.parent() {
                if let Err(error) = fs::create_dir_all(parent) {
                    eprintln!("Error: Could not create `{}`: {error}", parent.display());
                    std::process::exit(1);
                }
            }
            let json = serde_json::to_string_pretty(&ir).expect("IR should always serialize");
            if let Err(error) = fs::write(output_path, format!("{json}\n")) {
                eprintln!("Error: Could not write `{}`: {error}", output_path.display());
                std::process::exit(1);
            }
            println!("Compiled `{script_path}` → `{}`", output_path.display());
        }
        _ => {
            usage();
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::compile;

    const VALID: &str = r#"
base("base.jpg", width: 1280, height: 720)
cutout(source: "rider.png", mask: "person", id: "rider")
place(cutout: "rider", x: 0.62, y: 0.48, scale: 0.9, blend: "multiply")
palette(k: 8)
reverse(mode: "provenance-map")
reverse(mode: "palette-grid", k: 6)
output(obverse: "front.png", reverse: "back.png", manifest: "manifest.json")
"#;

    #[test]
    fn lowers_valid_script_to_ir() {
        let ir = compile(VALID).expect("valid v1 script");
        assert_eq!(ir.version, "robby-ir-v1");
        assert_eq!(ir.cutouts.len(), 1);
        assert_eq!(ir.layers[0].blend, "multiply");
        assert_eq!(ir.reverse.len(), 2);
    }

    #[test]
    fn requires_base_as_first_command() {
        let error = compile("reverse(mode: \"provenance-map\")").unwrap_err();
        assert!(error.message.contains("Missing `base` command"));
    }

    #[test]
    fn rejects_bad_coordinate() {
        let source = VALID.replace("x: 0.62", "x: 1.62");
        let error = compile(&source).unwrap_err();
        assert!(error.message.contains("normalized coordinates"));
    }

    #[test]
    fn rejects_unknown_mask() {
        let source = VALID.replace("mask: \"person\"", "mask: \"dog\"");
        let error = compile(&source).unwrap_err();
        assert!(error.message.contains("Unknown mask type"));
    }
}

