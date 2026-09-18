//! Parse Robby tokens into an AST without deciding whether the program is valid.

use crate::ast::{Argument, Clause, Command, Object, Recipe, Script, Span, Value};
use crate::error::{CompileResult, CompilerError};
use crate::lexer::{Token, TokenKind};

pub fn parse(tokens: &[Token]) -> CompileResult<Script> {
    Parser { tokens, cursor: 0 }.parse_script()
}

pub fn parse_recipe(tokens: &[Token]) -> CompileResult<Recipe> {
    Parser { tokens, cursor: 0 }.parse_recipe()
}

impl<'a> Parser<'a> {
    fn parse_recipe(&mut self) -> CompileResult<Recipe> {
        self.consume_newlines();
        let (name, span) = self.expect_identifier("Expected `object` at the start of a recipe.")?;
        if name != "object" {
            return Err(CompilerError::at(
                span.line,
                "Expected `object` at the start of a recipe.",
            ));
        }
        let object_name = match self.current().kind.clone() {
            TokenKind::String(value) => {
                self.advance();
                value
            }
            _ => return Err(self.error_here("Expected an object name string.")),
        };
        self.expect(
            |kind| matches!(kind, TokenKind::LeftBrace),
            "Expected `{` after object name.",
        )?;
        self.consume_newlines();
        let mut clauses = Vec::new();
        while !self.check(|kind| matches!(kind, TokenKind::RightBrace | TokenKind::Eof)) {
            clauses.push(self.parse_clause()?);
            self.consume_newlines();
        }
        self.expect(
            |kind| matches!(kind, TokenKind::RightBrace),
            "Expected `}` to close object.",
        )?;
        self.consume_newlines();
        if !self.at_eof() {
            return Err(self.error_here("Only one object recipe is supported."));
        }
        Ok(Recipe {
            object: Object {
                name: object_name,
                clauses,
            },
        })
    }

    fn parse_clause(&mut self) -> CompileResult<Clause> {
        let (raw_name, span) = self.expect_identifier("Expected a recipe clause.")?;
        // `evidence` is the reader-facing spelling; the IR keeps the original
        // v2 canonical clause name `inspect` for compatibility.
        let name = if raw_name == "evidence" {
            "inspect".to_string()
        } else {
            raw_name
        };
        let variant = if name == "split" || name == "reverse" {
            Some(self.expect_clause_mode()?)
        } else {
            None
        };
        let mut clause = Clause::new(name, variant, span);
        if self.matches(|kind| matches!(kind, TokenKind::LeftBrace)) {
            self.consume_newlines();
            while !self.check(|kind| matches!(kind, TokenKind::RightBrace | TokenKind::Eof)) {
                clause.entries.push(self.parse_entry()?);
                self.consume_newlines();
            }
            self.expect(
                |kind| matches!(kind, TokenKind::RightBrace),
                "Expected `}` to close clause.",
            )?;
        } else {
            clause.arguments.push(self.parse_argument()?);
        }
        Ok(clause)
    }

    fn expect_clause_mode(&mut self) -> CompileResult<String> {
        let token = self.current().clone();
        let value = match token.kind {
            TokenKind::Identifier(value) | TokenKind::String(value) => value,
            _ => return Err(self.error_here("Expected a clause mode.")),
        };
        self.advance();
        Ok(value.replace('-', "_"))
    }

    fn parse_entry(&mut self) -> CompileResult<Argument> {
        let span = self.current().span;
        let name = self.expect_identifier("Expected a clause entry name.")?.0;
        self.expect(
            |kind| matches!(kind, TokenKind::Colon),
            "Expected `:` after entry name.",
        )?;
        let mut value = self.parse_value()?;
        if let Value::Identifier(action) = value {
            if matches!(
                action.as_str(),
                "set" | "retain" | "keep" | "bands" | "grid"
            ) {
                let argument = self.parse_value()?;
                value = Value::Call {
                    name: action,
                    arguments: vec![argument],
                };
            } else {
                value = Value::Identifier(action);
            }
        }
        Ok(Argument {
            name: Some(name),
            value,
            span,
        })
    }
}

struct Parser<'a> {
    tokens: &'a [Token],
    cursor: usize,
}

impl<'a> Parser<'a> {
    fn parse_script(&mut self) -> CompileResult<Script> {
        let mut commands = Vec::new();
        self.consume_newlines();
        while !self.at_eof() {
            commands.push(self.parse_command()?);
            if self.matches(|kind| matches!(kind, TokenKind::Newline)) {
                self.consume_newlines();
            } else if !self.at_eof() {
                return Err(self.error_here("Expected a newline after this command."));
            }
        }
        Ok(Script { commands })
    }

    fn parse_command(&mut self) -> CompileResult<Command> {
        let (name, span) =
            self.expect_identifier("Expected a command name such as `base` or `palette`.")?;
        self.expect(
            |kind| matches!(kind, TokenKind::LeftParen),
            "Expected `(` after the command name.",
        )?;
        let mut arguments = Vec::new();
        if !self.check(|kind| matches!(kind, TokenKind::RightParen)) {
            loop {
                arguments.push(self.parse_argument()?);
                if self.matches(|kind| matches!(kind, TokenKind::Comma)) {
                    if self.check(|kind| matches!(kind, TokenKind::RightParen)) {
                        return Err(self.error_here("Expected an argument after `,`."));
                    }
                    continue;
                }
                break;
            }
        }
        self.expect(
            |kind| matches!(kind, TokenKind::RightParen),
            "Expected `)` to close this command.",
        )?;
        Ok(Command {
            name,
            arguments,
            span,
        })
    }

    fn parse_argument(&mut self) -> CompileResult<Argument> {
        let span = self.current().span;
        let name = if let TokenKind::Identifier(candidate) = &self.current().kind {
            if self.peek_is(|kind| matches!(kind, TokenKind::Colon)) {
                let name = candidate.clone();
                self.advance();
                self.advance();
                Some(name)
            } else {
                None
            }
        } else {
            None
        };
        let value = self.parse_value()?;
        Ok(Argument { name, value, span })
    }

    fn parse_value(&mut self) -> CompileResult<Value> {
        let token = self.current().clone();
        match token.kind {
            TokenKind::String(value) => {
                self.advance();
                Ok(Value::String(value))
            }
            TokenKind::Number(value) => {
                self.advance();
                Ok(Value::Number(value))
            }
            TokenKind::Identifier(value) => {
                self.advance();
                if self.matches(|kind| matches!(kind, TokenKind::LeftParen)) {
                    let mut arguments = Vec::new();
                    if !self.check(|kind| matches!(kind, TokenKind::RightParen)) {
                        loop {
                            arguments.push(self.parse_value()?);
                            if !self.matches(|kind| matches!(kind, TokenKind::Comma)) {
                                break;
                            }
                        }
                    }
                    self.expect(
                        |kind| matches!(kind, TokenKind::RightParen),
                        "Expected `)` to close call.",
                    )?;
                    Ok(Value::Call {
                        name: value,
                        arguments,
                    })
                } else {
                    Ok(Value::Identifier(value))
                }
            }
            _ => Err(CompilerError::at(
                token.span.line,
                "Expected a string, number, or identifier value.",
            )),
        }
    }

    fn expect_identifier(&mut self, message: &str) -> CompileResult<(String, Span)> {
        let token = self.current().clone();
        match token.kind {
            TokenKind::Identifier(value) => {
                self.advance();
                Ok((value, token.span))
            }
            _ => Err(CompilerError::at(token.span.line, message)),
        }
    }

    fn expect(
        &mut self,
        predicate: impl Fn(&TokenKind) -> bool,
        message: &str,
    ) -> CompileResult<()> {
        if self.check(predicate) {
            self.advance();
            Ok(())
        } else {
            Err(self.error_here(message))
        }
    }

    fn consume_newlines(&mut self) {
        while self.matches(|kind| matches!(kind, TokenKind::Newline)) {}
    }

    fn matches(&mut self, predicate: impl Fn(&TokenKind) -> bool) -> bool {
        if self.check(predicate) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn check(&self, predicate: impl Fn(&TokenKind) -> bool) -> bool {
        predicate(&self.current().kind)
    }

    fn peek_is(&self, predicate: impl Fn(&TokenKind) -> bool) -> bool {
        self.tokens
            .get(self.cursor + 1)
            .is_some_and(|token| predicate(&token.kind))
    }

    fn at_eof(&self) -> bool {
        matches!(self.current().kind, TokenKind::Eof)
    }

    fn current(&self) -> &Token {
        &self.tokens[self.cursor.min(self.tokens.len() - 1)]
    }

    fn advance(&mut self) {
        if !self.at_eof() {
            self.cursor += 1;
        }
    }

    fn error_here(&self, message: impl Into<String>) -> CompilerError {
        CompilerError::at(self.current().span.line, message)
    }
}
