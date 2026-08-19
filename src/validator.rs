//! Validation rules for the intentionally small Robby v1 language.

use std::collections::HashMap;

use crate::ast::{Argument, Command, Script, Value};
use crate::error::{CompileResult, CompilerError};

pub fn validate(script: &Script) -> CompileResult<()> {
    if script.commands.is_empty() || script.commands[0].name != "base" {
        return Err(CompilerError::plain(
            "Missing `base` command – every script must start with exactly one `base(...)`.",
        ));
    }

    let mut base_seen = false;
    let mut palette_seen = false;
    let mut reverse_seen = false;
    let mut output_seen = false;
    for (index, command) in script.commands.iter().enumerate() {
        match command.name.as_str() {
            "base" => {
                if index != 0 || base_seen {
                    return Err(error(
                        command,
                        "Exactly one `base(...)` command is allowed, and it must be first.",
                    ));
                }
                base_seen = true;
                validate_base(command)?;
            }
            "palette" => {
                if palette_seen {
                    return Err(error(
                        command,
                        "Only one `palette(...)` command is allowed.",
                    ));
                }
                palette_seen = true;
                let values = named(command, &["k"])?;
                validate_palette_k(&values, command)?;
            }
            "reverse" => {
                if reverse_seen {
                    return Err(error(
                        command,
                        "Exactly one `reverse(...)` command is allowed.",
                    ));
                }
                reverse_seen = true;
                validate_reverse(command)?;
            }
            "output" => {
                if output_seen {
                    return Err(error(command, "Only one `output(...)` command is allowed."));
                }
                if index != script.commands.len() - 1 {
                    return Err(error(command, "`output(...)` must be the final command."));
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
                    format!(
                        "Unknown command `{other}`. v1 commands are `base`, `palette`, `reverse`, and `output`."
                    ),
                ));
            }
        }
    }

    if !reverse_seen {
        return Err(CompilerError::plain(
            "Missing `reverse(...)` command – every script needs a reverse declaration.",
        ));
    }
    if !output_seen {
        return Err(CompilerError::plain(
            "Missing `output(...)` command – declare output names and the manifest name.",
        ));
    }
    Ok(())
}

fn validate_base(command: &Command) -> CompileResult<()> {
    let positional: Vec<&Argument> = command
        .arguments
        .iter()
        .filter(|argument| argument.name.is_none())
        .collect();
    if positional.len() != 1 {
        return Err(error(
            command,
            "`base(...)` requires one positional image path, for example `base(\"image.jpg\")`.",
        ));
    }
    if positional[0].value.as_string().is_none() {
        return Err(error(command, "The base image path must be a string."));
    }
    let values = named_base(command)?;
    validate_positive_integer(&values, "width", command)?;
    validate_positive_integer(&values, "height", command)?;
    Ok(())
}

fn validate_reverse(command: &Command) -> CompileResult<()> {
    let values = named(command, &["mode"])?;
    let mode = required_string(&values, "mode", command)?;
    if mode != "negative" {
        return Err(error(
            command,
            format!("Unknown reverse mode `{mode}`. v1 supports `negative`."),
        ));
    }
    Ok(())
}

fn named<'a>(command: &'a Command, allowed: &[&str]) -> CompileResult<HashMap<String, &'a Value>> {
    let mut values = HashMap::new();
    for argument in &command.arguments {
        let Some(name) = &argument.name else {
            return Err(error(
                command,
                format!("`{}` does not accept positional arguments.", command.name),
            ));
        };
        if !allowed.contains(&name.as_str()) {
            return Err(error(
                command,
                format!("Unknown argument `{name}` for `{}`.", command.name),
            ));
        }
        if values.insert(name.clone(), &argument.value).is_some() {
            return Err(error(
                command,
                format!("Argument `{name}` is declared more than once."),
            ));
        }
    }
    Ok(values)
}

fn named_base(command: &Command) -> CompileResult<HashMap<String, &Value>> {
    let mut values = HashMap::new();
    for argument in &command.arguments {
        let Some(name) = &argument.name else { continue };
        if !["width", "height"].contains(&name.as_str()) {
            return Err(error(
                command,
                format!("Unknown argument `{name}` for `base`."),
            ));
        }
        if values.insert(name.clone(), &argument.value).is_some() {
            return Err(error(
                command,
                format!("Argument `{name}` is declared more than once."),
            ));
        }
    }
    Ok(values)
}

fn required_string<'a>(
    values: &HashMap<String, &'a Value>,
    key: &str,
    command: &Command,
) -> CompileResult<&'a str> {
    match values.get(key) {
        Some(value) => value
            .as_string()
            .ok_or_else(|| type_error(command, key, value, "a string")),
        None => Err(error(
            command,
            format!("Missing required `{key}` argument."),
        )),
    }
}

fn validate_positive_integer(
    values: &HashMap<String, &Value>,
    key: &str,
    command: &Command,
) -> CompileResult<()> {
    if let Some(value) = values.get(key) {
        let number = value
            .as_number()
            .ok_or_else(|| type_error(command, key, value, "a number"))?;
        if number <= 0.0 || number.fract() != 0.0 || number > 4096.0 {
            return Err(error(
                command,
                format!("`{key}` must be a positive integer no greater than 4096."),
            ));
        }
    }
    Ok(())
}

fn validate_palette_k(values: &HashMap<String, &Value>, command: &Command) -> CompileResult<()> {
    if let Some(value) = values.get("k") {
        let number = value
            .as_number()
            .ok_or_else(|| type_error(command, "k", value, "a number"))?;
        if !(3.0..=16.0).contains(&number) || number.fract() != 0.0 {
            return Err(error(command, "`k` must be an integer between 3 and 16."));
        }
    }
    Ok(())
}

fn error(command: &Command, message: impl Into<String>) -> CompilerError {
    CompilerError::at(command.span.line, message)
}

fn type_error(command: &Command, key: &str, value: &Value, expected: &str) -> CompilerError {
    error(
        command,
        format!(
            "`{key}` must be {expected}, but received {}.",
            value.type_name()
        ),
    )
}
