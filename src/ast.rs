//! The small syntax tree produced by the parser before semantic validation.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    String(String),
    Number(f64),
    Identifier(String),
}

impl Value {
    pub fn type_name(&self) -> &'static str {
        match self {
            Self::String(_) => "a string",
            Self::Number(_) => "a number",
            Self::Identifier(_) => "an identifier",
        }
    }

    pub fn as_string(&self) -> Option<&str> {
        match self {
            Self::String(value) => Some(value),
            _ => None,
        }
    }

    pub fn as_number(&self) -> Option<f64> {
        match self {
            Self::Number(value) => Some(*value),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Argument {
    pub name: Option<String>,
    pub value: Value,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Command {
    pub name: String,
    pub arguments: Vec<Argument>,
    pub span: Span,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Script {
    pub commands: Vec<Command>,
}
