//! Diagnostics shared by every compiler pass.

use std::fmt::{self, Display};

/// A source-oriented compiler error that can be printed by the CLI or returned
/// through the WebAssembly adapter without losing the authored line number.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompilerError {
    pub line: Option<usize>,
    pub message: String,
}

impl CompilerError {
    pub fn at(line: usize, message: impl Into<String>) -> Self {
        Self {
            line: Some(line),
            message: message.into(),
        }
    }

    pub fn plain(message: impl Into<String>) -> Self {
        Self {
            line: None,
            message: message.into(),
        }
    }
}

impl Display for CompilerError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.line {
            Some(line) => write!(formatter, "Error on line {line}: {}", self.message),
            None => write!(formatter, "Error: {}", self.message),
        }
    }
}

impl std::error::Error for CompilerError {}

pub type CompileResult<T> = Result<T, CompilerError>;
