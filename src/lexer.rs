//! A line-aware lexer for the Robby v1 command language.

use crate::ast::Span;
use crate::error::{CompileResult, CompilerError};

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    Identifier(String),
    String(String),
    Number(f64),
    LeftParen,
    RightParen,
    Comma,
    Colon,
    Newline,
    Eof,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub span: Span,
}

/// Turn Robby source into tokens. Comments start with `#` outside strings.
pub fn lex(source: &str) -> CompileResult<Vec<Token>> {
    let characters: Vec<char> = source.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;
    let mut line = 1;
    let mut column = 1;

    while index < characters.len() {
        let character = characters[index];
        let span = Span { line, column };
        match character {
            ' ' | '\t' | '\r' => {
                index += 1;
                column += 1;
            }
            '\n' => {
                tokens.push(Token {
                    kind: TokenKind::Newline,
                    span,
                });
                index += 1;
                line += 1;
                column = 1;
            }
            '#' => {
                while index < characters.len() && characters[index] != '\n' {
                    index += 1;
                    column += 1;
                }
            }
            '(' => {
                tokens.push(Token {
                    kind: TokenKind::LeftParen,
                    span,
                });
                index += 1;
                column += 1;
            }
            ')' => {
                tokens.push(Token {
                    kind: TokenKind::RightParen,
                    span,
                });
                index += 1;
                column += 1;
            }
            ',' => {
                tokens.push(Token {
                    kind: TokenKind::Comma,
                    span,
                });
                index += 1;
                column += 1;
            }
            ':' => {
                tokens.push(Token {
                    kind: TokenKind::Colon,
                    span,
                });
                index += 1;
                column += 1;
            }
            '"' | '\'' => {
                let quote = character;
                index += 1;
                column += 1;
                let mut value = String::new();
                let mut closed = false;
                while index < characters.len() {
                    let next = characters[index];
                    if next == quote {
                        index += 1;
                        column += 1;
                        closed = true;
                        break;
                    }
                    if next == '\\' {
                        let Some(escaped) = characters.get(index + 1).copied() else {
                            return Err(CompilerError::at(line, "Unterminated escape sequence in string literal."));
                        };
                        value.push(match escaped {
                            'n' => '\n',
                            '\\' => '\\',
                            '\'' => '\'',
                            '"' => '"',
                            other => other,
                        });
                        index += 2;
                        column += 2;
                        continue;
                    }
                    if next == '\n' {
                        return Err(CompilerError::at(line, "Unterminated string literal."));
                    }
                    value.push(next);
                    index += 1;
                    column += 1;
                }
                if !closed {
                    return Err(CompilerError::at(span.line, "Unterminated string literal."));
                }
                tokens.push(Token {
                    kind: TokenKind::String(value),
                    span,
                });
            }
            next
                if next.is_ascii_digit()
                    || (next == '-'
                        && characters
                            .get(index + 1)
                            .is_some_and(|following| following.is_ascii_digit())) =>
            {
                let start = index;
                if character == '-' {
                    index += 1;
                    column += 1;
                }
                let mut dot_seen = false;
                while index < characters.len() {
                    let next = characters[index];
                    if next.is_ascii_digit() {
                        index += 1;
                        column += 1;
                    } else if next == '.' && !dot_seen {
                        dot_seen = true;
                        index += 1;
                        column += 1;
                    } else {
                        break;
                    }
                }
                let raw: String = characters[start..index].iter().collect();
                let number = raw
                    .parse::<f64>()
                    .map_err(|_| CompilerError::at(span.line, format!("Could not parse `{raw}` as a number.")))?;
                if !number.is_finite() {
                    return Err(CompilerError::at(span.line, "Numbers must be finite."));
                }
                tokens.push(Token {
                    kind: TokenKind::Number(number),
                    span,
                });
            }
            next if next.is_ascii_alphabetic() || next == '_' => {
                let start = index;
                while index < characters.len()
                    && (characters[index].is_ascii_alphanumeric()
                        || characters[index] == '_'
                        || characters[index] == '-')
                {
                    index += 1;
                    column += 1;
                }
                tokens.push(Token {
                    kind: TokenKind::Identifier(characters[start..index].iter().collect()),
                    span,
                });
            }
            other => {
                return Err(CompilerError::at(
                    span.line,
                    format!("Unexpected character `{other}` in source."),
                ));
            }
        }
    }

    tokens.push(Token {
        kind: TokenKind::Eof,
        span: Span { line, column },
    });
    Ok(tokens)
}
