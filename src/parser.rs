//! Parse Robby tokens into an AST without deciding whether the program is valid.

use crate::ast::{Argument, Command, Script, Span, Value};
use crate::error::{CompileResult, CompilerError};
use crate::lexer::{Token, TokenKind};

pub fn parse(tokens: &[Token]) -> CompileResult<Script> {
    Parser { tokens, cursor: 0 }.parse_script()
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
                Ok(Value::Identifier(value))
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
