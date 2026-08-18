//! Semantic rules for the intentionally small Robby v1 language.

use std::collections::{HashMap, HashSet};

use crate::ast::{Argument, Command, Script, Value};
use crate::error::{CompileResult, CompilerError};

pub fn validate(script: &Script) -> CompileResult<()> {
    if script.commands.is_empty() {
        return Err(CompilerError::plain(
            "Missing `base` command – every script must start with exactly one `base(...)`.",
        ));
    }
    if script.commands[0].name != "base" {
        return Err(CompilerError::at(
            script.commands[0].span.line,
            "Missing `base` command – every script must start with exactly one `base(...)`.",
        ));
    }

    let mut base_seen = false;
    let mut output_seen = false;
    let mut palette_seen = false;
    let mut reverse_count = 0;
    let mut reverse_modes = HashSet::new();
    let mut cutout_ids = HashSet::new();

    for (index, command) in script.commands.iter().enumerate() {
        match command.name.as_str() {
            "base" => {
                if index != 0 || base_seen {
                    return Err(error(command, "Exactly one `base(...)` command is allowed, and it must be first."));
                }
                base_seen = true;
                validate_base(command)?;
            }
            "cutout" => validate_cutout(command, &mut cutout_ids)?,
            "place" => validate_place(command, &cutout_ids)?,
            "palette" => {
                if palette_seen {
                    return Err(error(command, "Only one `palette(...)` command is allowed."));
                }
                palette_seen = true;
                let values = named(command, &["k"])?;
                validate_palette_k(&values, "k", command)?;
            }
            "reverse" => {
                reverse_count += 1;
                if reverse_count > 2 {
                    return Err(error(command, "v1 supports at most two `reverse(...)` commands."));
                }
                let mode = validate_reverse(command)?;
                if !reverse_modes.insert(mode.clone()) {
                    return Err(error(command, format!("Duplicate reverse mode `{mode}`. Declare each reverse mode at most once.")));
                }
            }
            "output" => {
                if output_seen {
                    return Err(error(command, "Only one `output(...)` command is allowed."));
                }
                if index != script.commands.len() - 1 {
                    return Err(error(command, "`output(...)` must be the final command so the script reads in execution order."));
                }
                output_seen = true;
                let values = named(command, &["obverse", "reverse", "manifest"])?;
                required_string(&values, "obverse", command)?;
                required_string(&values, "reverse", command)?;
                required_string(&values, "manifest", command)?;
            }
            other => {
                return Err(error(
                    command,
                    format!("Unknown command `{other}`. v1 commands are `base`, `cutout`, `place`, `palette`, `reverse`, and `output`."),
                ));
            }
        }
    }

    if reverse_count == 0 {
        return Err(CompilerError::plain(
            "Missing `reverse(...)` command – every composition needs an inspectable reverse image.",
        ));
    }
    if !output_seen {
        return Err(CompilerError::plain(
            "Missing `output(...)` command – declare obverse, reverse, and manifest filenames.",
        ));
    }
    Ok(())
}

fn validate_base(command: &Command) -> CompileResult<()> {
    let positional: Vec<&Argument> = command.arguments.iter().filter(|argument| argument.name.is_none()).collect();
    if positional.len() != 1 {
        return Err(error(command, "`base(...)` requires one positional image path, for example `base(\"image.jpg\")`."));
    }
    if positional[0].value.as_string().is_none() {
        return Err(error(command, "The base image path must be a string."));
    }
    let values = named_base(command)?;
    validate_positive_integer(&values, "width", command)?;
    validate_positive_integer(&values, "height", command)?;
    Ok(())
}

fn validate_cutout(command: &Command, ids: &mut HashSet<String>) -> CompileResult<()> {
    let values = named(command, &["source", "mask", "id"])?;
    required_string(&values, "source", command)?;
    let id = required_string(&values, "id", command)?;
    if !ids.insert(id.to_string()) {
        return Err(error(command, format!("Cutout id `{id}` is already declared.")));
    }
    let mask = required_string(&values, "mask", command)?;
    if !["person", "sky"].contains(&mask) {
        return Err(error(command, format!("Unknown mask type `{mask}`. v1 supports `person` and `sky`.")));
    }
    Ok(())
}

fn validate_place(command: &Command, ids: &HashSet<String>) -> CompileResult<()> {
    let values = named(command, &["cutout", "x", "y", "scale", "rotation", "opacity", "blend"])?;
    let cutout = required_string(&values, "cutout", command)?;
    if !ids.contains(cutout) {
        return Err(error(command, format!("Unknown cutout `{cutout}`. Declare it with `cutout(...)` before placing it.")));
    }
    let x = required_number(&values, "x", command)?;
    let y = required_number(&values, "y", command)?;
    if !(0.0..=1.0).contains(&x) || !(0.0..=1.0).contains(&y) {
        return Err(error(command, "`x` and `y` must be normalized coordinates from 0.0 to 1.0."));
    }
    if let Some(scale) = optional_number(&values, "scale", command)? {
        if scale <= 0.0 {
            return Err(error(command, "`scale` must be greater than 0."));
        }
    }
    optional_number(&values, "rotation", command)?;
    if let Some(opacity) = optional_number(&values, "opacity", command)? {
        if !(0.0..=1.0).contains(&opacity) {
            return Err(error(command, "`opacity` must be between 0.0 and 1.0."));
        }
    }
    if let Some(blend) = values.get("blend") {
        let blend = blend.as_string().ok_or_else(|| type_error(command, "blend", blend, "a string"))?;
        if !["normal", "multiply", "screen", "overlay"].contains(&blend) {
            return Err(error(command, format!("Unknown blend mode `{blend}`. v1 supports `normal`, `multiply`, `screen`, and `overlay`.")));
        }
    }
    Ok(())
}

fn validate_reverse(command: &Command) -> CompileResult<String> {
    let values = named(command, &["mode", "k"])?;
    let mode = required_string(&values, "mode", command)?;
    if !["provenance-map", "palette-grid"].contains(&mode) {
        return Err(error(command, format!("Unknown reverse mode `{mode}`. v1 supports `provenance-map` and `palette-grid`.")));
    }
    if mode == "provenance-map" && values.contains_key("k") {
        return Err(error(command, "`k` is only valid for `reverse(mode: \"palette-grid\")`."));
    }
    if mode == "palette-grid" {
        validate_palette_k(&values, "k", command)?;
    }
    Ok(mode.to_string())
}

fn named<'a>(command: &'a Command, allowed: &[&str]) -> CompileResult<HashMap<String, &'a Value>> {
    let mut values = HashMap::new();
    for argument in &command.arguments {
        let Some(name) = &argument.name else {
            return Err(error(command, format!("`{}` does not accept positional arguments.", command.name)));
        };
        if !allowed.contains(&name.as_str()) {
            return Err(error(command, format!("Unknown argument `{name}` for `{}`.", command.name)));
        }
        if values.insert(name.clone(), &argument.value).is_some() {
            return Err(error(command, format!("Argument `{name}` is declared more than once.")));
        }
    }
    Ok(values)
}

fn named_base(command: &Command) -> CompileResult<HashMap<String, &Value>> {
    let mut values = HashMap::new();
    for argument in &command.arguments {
        let Some(name) = &argument.name else { continue };
        if !["width", "height"].contains(&name.as_str()) {
            return Err(error(command, format!("Unknown argument `{name}` for `base`.")));
        }
        if values.insert(name.clone(), &argument.value).is_some() {
            return Err(error(command, format!("Argument `{name}` is declared more than once.")));
        }
    }
    Ok(values)
}

fn required_string<'a>(values: &HashMap<String, &'a Value>, key: &str, command: &Command) -> CompileResult<&'a str> {
    match values.get(key) {
        Some(value) => value.as_string().ok_or_else(|| type_error(command, key, value, "a string")),
        None => Err(error(command, format!("Missing required `{key}` argument."))),
    }
}

fn required_number(values: &HashMap<String, &Value>, key: &str, command: &Command) -> CompileResult<f64> {
    match values.get(key) {
        Some(value) => value.as_number().ok_or_else(|| type_error(command, key, value, "a number")),
        None => Err(error(command, format!("Missing required `{key}` argument."))),
    }
}

fn optional_number(values: &HashMap<String, &Value>, key: &str, command: &Command) -> CompileResult<Option<f64>> {
    match values.get(key) {
        Some(value) => value.as_number().map(Some).ok_or_else(|| type_error(command, key, value, "a number")),
        None => Ok(None),
    }
}

fn validate_positive_integer(values: &HashMap<String, &Value>, key: &str, command: &Command) -> CompileResult<()> {
    if let Some(value) = values.get(key) {
        let number = value.as_number().ok_or_else(|| type_error(command, key, value, "a number"))?;
        if number <= 0.0 || number.fract() != 0.0 || number > u32::MAX as f64 {
            return Err(error(command, format!("`{key}` must be a positive integer.")));
        }
    }
    Ok(())
}

fn validate_palette_k(values: &HashMap<String, &Value>, key: &str, command: &Command) -> CompileResult<()> {
    if let Some(value) = values.get(key) {
        let number = value.as_number().ok_or_else(|| type_error(command, key, value, "a number"))?;
        if !(3.0..=16.0).contains(&number) || number.fract() != 0.0 {
            return Err(error(command, format!("`{key}` must be an integer between 3 and 16.")));
        }
    }
    Ok(())
}

fn error(command: &Command, message: impl Into<String>) -> CompilerError {
    CompilerError::at(command.span.line, message)
}

fn type_error(command: &Command, key: &str, value: &Value, expected: &str) -> CompilerError {
    error(command, format!("`{key}` must be {expected}, but received {}.", value.type_name()))
}
