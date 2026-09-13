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
                if reverse_seen {
                    return Err(error(
                        command,
                        "`palette(...)` must appear before `reverse(...)`.",
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
                let reverse_target = required_string(&values, "reverse", command)?;
                if reverse_target != "transient" {
                    return Err(error(
                        command,
                        "The `reverse` output target must be \"transient\" — durable reverse paths are forbidden.",
                    ));
                }
                let manifest_target = required_string(&values, "manifest", command)?;
                if manifest_target != "transient" {
                    return Err(error(
                        command,
                        "The `manifest` output target must be \"transient\" — durable manifest paths are forbidden.",
                    ));
                }
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

/// Validate the Phase 3 recipe grammar without changing the v1 validator.
pub fn validate_recipe(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clauses = &recipe.object.clauses;
    let allowed = [
        "input", "inspect", "context", "split", "measure", "bind", "reverse", "publish",
    ];
    for clause in clauses {
        if !allowed.contains(&clause.name.as_str()) {
            return Err(CompilerError::at(
                clause.span.line,
                format!("Unknown recipe clause `{}`.", clause.name),
            ));
        }
    }
    let count = |name: &str| clauses.iter().filter(|clause| clause.name == name).count();
    if count("input") != 1 {
        return Err(CompilerError::plain(
            "A recipe requires exactly one `input` clause; multi-image compositing is unsupported.",
        ));
    }
    for name in [
        "inspect", "context", "split", "measure", "bind", "reverse", "publish",
    ] {
        if count(name) != 1 {
            return Err(CompilerError::plain(format!(
                "A recipe requires exactly one `{name}` clause."
            )));
        }
    }
    let input = clauses
        .iter()
        .find(|clause| clause.name == "input")
        .unwrap();
    if input.arguments.len() != 1 || input.arguments[0].value.as_string().is_none() {
        return Err(CompilerError::at(
            input.span.line,
            "`input` requires one image path string.",
        ));
    }
    validate_entries(
        recipe,
        "inspect",
        &["exif", "iptc", "xmp", "c2pa", "gps"],
        &[
            ("exif", &["read"]),
            ("iptc", &["read"]),
            ("xmp", &["read"]),
            ("c2pa", &["verify"]),
            ("gps", &["private"]),
        ],
    )?;
    validate_context(recipe)?;
    validate_split(recipe)?;
    validate_measure(recipe)?;
    validate_bind(recipe)?;
    validate_reverse_recipe(recipe)?;
    validate_publish(recipe)?;
    Ok(())
}

fn recipe_clause<'a>(recipe: &'a crate::ast::Recipe, name: &str) -> &'a crate::ast::Clause {
    recipe
        .object
        .clauses
        .iter()
        .find(|clause| clause.name == name)
        .unwrap()
}

fn validate_entries(
    recipe: &crate::ast::Recipe,
    clause_name: &str,
    names: &[&str],
    values: &[(&str, &[&str])],
) -> CompileResult<()> {
    let clause = recipe_clause(recipe, clause_name);
    for entry in &clause.entries {
        let key = entry.name.as_deref().unwrap_or_default();
        let Some(allowed_values) = values
            .iter()
            .find(|(name, _)| *name == key)
            .map(|(_, values)| *values)
        else {
            return Err(CompilerError::at(
                clause.span.line,
                format!("Unknown {clause_name} directive `{key}`."),
            ));
        };
        let Some(value) = value_identifier(&entry.value) else {
            return Err(CompilerError::at(
                entry.span.line,
                format!("`{key}` in `{clause_name}` must use a supported directive."),
            ));
        };
        if !allowed_values.contains(&value) {
            return Err(CompilerError::at(
                entry.span.line,
                format!("Unsupported {clause_name} directive `{key}: {value}`."),
            ));
        }
    }
    if clause
        .entries
        .iter()
        .any(|entry| !names.contains(&entry.name.as_deref().unwrap_or_default()))
    {
        return Err(CompilerError::at(
            clause.span.line,
            format!("Unsupported {clause_name} directive."),
        ));
    }
    Ok(())
}

fn validate_context(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clause = recipe_clause(recipe, "context");
    let allowed = ["place", "time", "era", "source_capture_time", "source_gps"];
    for entry in &clause.entries {
        let key = entry.name.as_deref().unwrap_or_default();
        if !allowed.contains(&key) {
            return Err(CompilerError::at(
                entry.span.line,
                format!("Unsupported context directive `{key}`."),
            ));
        }
        match key {
            "place" | "time" | "era" => {
                if !matches!(entry.value, Value::Call { ref name, .. } if name == "set") {
                    return Err(CompilerError::at(
                        entry.span.line,
                        "Context declarations must be tagged `set` and remain declared.",
                    ));
                }
            }
            "source_capture_time" => {
                if !matches!(entry.value, Value::Call { ref name, .. } if name == "retain") {
                    return Err(CompilerError::at(
                        entry.span.line,
                        "Unsupported context privacy directive; use `retain observed`.",
                    ));
                }
            }
            "source_gps" => {
                if !matches!(entry.value, Value::Call { ref name, .. } if name == "keep") {
                    return Err(CompilerError::at(
                        entry.span.line,
                        "Unsupported context privacy directive; use `keep private`.",
                    ));
                }
            }
            _ => unreachable!(),
        }
    }
    Ok(())
}

fn validate_split(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clause = recipe_clause(recipe, "split");
    if clause.variant.as_deref() != Some("palette") {
        return Err(CompilerError::at(
            clause.span.line,
            "Only `split palette` is supported.",
        ));
    }
    let values = entry_map(clause);
    if value_identifier(
        values
            .get("method")
            .ok_or_else(|| CompilerError::at(clause.span.line, "Missing palette method."))?,
    ) != Some("median_cut")
    {
        return Err(CompilerError::at(
            clause.span.line,
            "Unsupported palette method; only `median_cut` is supported.",
        ));
    }
    let colours = values
        .get("colours")
        .and_then(|value| value.as_number())
        .unwrap_or(0.0);
    if !(3.0..=32.0).contains(&colours) || colours.fract() != 0.0 {
        return Err(CompilerError::at(
            clause.span.line,
            "Palette `colours` must be an integer between 3 and 32.",
        ));
    }
    if value_identifier(
        values
            .get("order")
            .ok_or_else(|| CompilerError::at(clause.span.line, "Missing palette order."))?,
    ) != Some("frequency")
    {
        return Err(CompilerError::at(
            clause.span.line,
            "Unsupported palette order; only `frequency` is supported.",
        ));
    }
    Ok(())
}

fn validate_measure(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clause = recipe_clause(recipe, "measure");
    for entry in &clause.entries {
        if !["luminance", "texture"].contains(&entry.name.as_deref().unwrap_or_default())
            || !matches!(entry.value, Value::Call { ref name, .. } if name == "bands" || name == "grid")
        {
            return Err(CompilerError::at(
                entry.span.line,
                "Unsupported measure directive.",
            ));
        }
    }
    Ok(())
}

fn validate_bind(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clause = recipe_clause(recipe, "bind");
    let allowed = [
        ("source", "sha256"),
        ("pixels", "canonical_rgba_sha256"),
        ("recipe", "canonical_ir"),
        ("evidence", "verified_public"),
        ("compiler", "version"),
    ];
    for entry in &clause.entries {
        let key = entry.name.as_deref().unwrap_or_default();
        let value = value_identifier(&entry.value).unwrap_or_default();
        if !allowed.contains(&(key, value)) {
            return Err(CompilerError::at(
                entry.span.line,
                format!("Unsupported binding directive `{key}: {value}`."),
            ));
        }
    }
    Ok(())
}

fn validate_reverse_recipe(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clause = recipe_clause(recipe, "reverse");
    if !["quantised_obverse", "palette_grid"]
        .contains(&clause.variant.as_deref().unwrap_or_default())
    {
        return Err(CompilerError::at(
            clause.span.line,
            "Unsupported reverse mode.",
        ));
    }
    let values = entry_map(clause);
    let mode = clause.variant.as_deref().unwrap();
    let required: &[(&str, &str)] = if mode == "palette_grid" {
        &[
            ("arrange", "seeded_shuffle"),
            ("seed", "object_binding"),
            ("border", "source_palette"),
        ]
    } else {
        &[("palette", "active"), ("dither", "none")]
    };
    for (key, expected) in required {
        let value = values.get(*key).ok_or_else(|| {
            CompilerError::at(
                clause.span.line,
                format!("Missing reverse directive `{key}`."),
            )
        })?;
        if value_identifier(value) != Some(*expected) {
            return Err(CompilerError::at(
                clause.span.line,
                format!(
                    "Unsupported reverse directive `{key}`{}.",
                    if *key == "seed" {
                        "; unsupported seed source"
                    } else {
                        ""
                    }
                ),
            ));
        }
    }
    if mode == "palette_grid"
        && values
            .get("cell")
            .and_then(|value| value.as_number())
            .is_none()
    {
        return Err(CompilerError::at(
            clause.span.line,
            "Palette grid `cell` must be numeric.",
        ));
    }
    Ok(())
}

fn validate_publish(recipe: &crate::ast::Recipe) -> CompileResult<()> {
    let clause = recipe_clause(recipe, "publish");
    let allowed = [
        ("gps", "remove"),
        ("capture_time", "redact"),
        ("c2pa", "summary"),
        ("manifest", "public_safe"),
    ];
    for entry in &clause.entries {
        let key = entry.name.as_deref().unwrap_or_default();
        let value = value_identifier(&entry.value).unwrap_or_default();
        if !allowed.contains(&(key, value)) {
            return Err(CompilerError::at(
                entry.span.line,
                format!("Unsupported publish directive `{key}: {value}`."),
            ));
        }
    }
    Ok(())
}

fn entry_map<'a>(clause: &'a crate::ast::Clause) -> HashMap<&'a str, &'a Value> {
    clause
        .entries
        .iter()
        .filter_map(|entry| entry.name.as_deref().map(|name| (name, &entry.value)))
        .collect()
}
fn value_identifier(value: &Value) -> Option<&str> {
    match value {
        Value::Identifier(value) => Some(value),
        _ => None,
    }
}
