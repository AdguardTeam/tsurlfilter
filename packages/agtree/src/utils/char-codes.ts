/**
 * @file Common character codes used throughout the parser pipeline.
 *
 * Centralizes character code constants to avoid duplication across
 * tokenizer, preparser, and AST parser modules.
 */

/**
 * Whitespace characters.
 */
export const CHAR_TAB = 0x09;
export const CHAR_LINE_FEED = 0x0A;
export const CHAR_CARRIAGE_RETURN = 0x0D;
export const CHAR_SPACE = 0x20;

/**
 * Punctuation and operators.
 */
export const CHAR_EXCLAMATION = 0x21;
export const CHAR_DOUBLE_QUOTE = 0x22;
export const CHAR_HASH = 0x23;
export const CHAR_DOLLAR = 0x24;
export const CHAR_PERCENT = 0x25;
export const CHAR_AMPERSAND = 0x26;
export const CHAR_SINGLE_QUOTE = 0x27;
export const CHAR_OPEN_PAREN = 0x28;
export const CHAR_CLOSE_PAREN = 0x29;
export const CHAR_ASTERISK = 0x2A;
export const CHAR_PLUS = 0x2B;
export const CHAR_COMMA = 0x2C;
export const CHAR_MINUS = 0x2D;
export const CHAR_DOT = 0x2E;
export const CHAR_SLASH = 0x2F;

/**
 * Digit character codes.
 */
export const CHAR_0 = 0x30;
export const CHAR_9 = 0x39;

/**
 * Special characters.
 */
export const CHAR_COLON = 0x3A;
export const CHAR_SEMICOLON = 0x3B;
export const CHAR_LESS_THAN = 0x3C;
export const CHAR_EQUALS = 0x3D;
export const CHAR_GREATER_THAN = 0x3E;
export const CHAR_QUESTION = 0x3F;
export const CHAR_AT = 0x40;

/**
 * Uppercase letter character codes.
 */
export const CHAR_UPPER_A = 0x41;
export const CHAR_UPPER_Z = 0x5A;

/**
 * Brackets, backslash, and related characters.
 */
export const CHAR_OPEN_BRACKET = 0x5B;
export const CHAR_BACKSLASH = 0x5C;
export const CHAR_CLOSE_BRACKET = 0x5D;
export const CHAR_CARET = 0x5E;
export const CHAR_UNDERSCORE = 0x5F;
export const CHAR_BACKTICK = 0x60;

/**
 * Lowercase letter character codes.
 */
export const CHAR_LOWER_A = 0x61;
export const CHAR_LOWER_Z = 0x7A;

/**
 * Braces and pipe.
 */
export const CHAR_OPEN_BRACE = 0x7B;
export const CHAR_PIPE = 0x7C;
export const CHAR_CLOSE_BRACE = 0x7D;
export const CHAR_TILDE = 0x7E;
