/**
 * @file Character code constants.
 *
 * Centralized character code definitions used across tokenizer and parsers.
 * Each exported value is the result of `String.prototype.charCodeAt(0)` — i.e.
 * a numeric character code, not a string character.
 * Using `.charCodeAt(0)` at module level ensures these are compile-time constants.
 */

/**
 * Space character (` `).
 */
export const CHAR_SPACE = ' '.charCodeAt(0);

/**
 * Tab character (`\t`).
 */
export const CHAR_TAB = '\t'.charCodeAt(0);

/**
 * Backslash character (`\`).
 */
export const CHAR_BACKSLASH = '\\'.charCodeAt(0);

/**
 * Dollar sign character (`$`).
 */
export const CHAR_DOLLAR_SIGN = '$'.charCodeAt(0);

/**
 * Forward slash character (`/`).
 */
export const CHAR_SLASH = '/'.charCodeAt(0);

/**
 * Equals sign character (`=`).
 */
export const CHAR_EQUALS_SIGN = '='.charCodeAt(0);

/**
 * Comma character (`,`).
 */
export const CHAR_COMMA = ','.charCodeAt(0);

/**
 * Open parenthesis character (`(`).
 */
export const CHAR_OPEN_PAREN = '('.charCodeAt(0);

/**
 * Close parenthesis character (`)`).
 */
export const CHAR_CLOSE_PAREN = ')'.charCodeAt(0);

/**
 * Open brace character (`{`).
 */
export const CHAR_OPEN_BRACE = '{'.charCodeAt(0);

/**
 * Close brace character (`}`).
 */
export const CHAR_CLOSE_BRACE = '}'.charCodeAt(0);

/**
 * Open square bracket character (`[`).
 */
export const CHAR_OPEN_SQUARE = '['.charCodeAt(0);

/**
 * Close square bracket character (`]`).
 */
export const CHAR_CLOSE_SQUARE = ']'.charCodeAt(0);

/**
 * Apostrophe character (`'`).
 */
export const CHAR_APOSTROPHE = "'".charCodeAt(0);

/**
 * Double quote character (`"`).
 */
export const CHAR_QUOTE = '"'.charCodeAt(0);

/**
 * Hash/number sign character (`#`).
 */
export const CHAR_HASHMARK = '#'.charCodeAt(0);

/**
 * Question mark character (`?`).
 */
export const CHAR_QUESTION_MARK = '?'.charCodeAt(0);

/**
 * Percent sign character (`%`).
 */
export const CHAR_PERCENT = '%'.charCodeAt(0);

/**
 * At sign character (`@`).
 */
export const CHAR_AT_SIGN = '@'.charCodeAt(0);

/**
 * Asterisk character (`*`).
 */
export const CHAR_ASTERISK = '*'.charCodeAt(0);

/**
 * Pipe character (`|`).
 */
export const CHAR_PIPE = '|'.charCodeAt(0);

/**
 * Exclamation mark character (`!`).
 */
export const CHAR_EXCLAMATION_MARK = '!'.charCodeAt(0);

/**
 * Plus sign character (`+`).
 */
export const CHAR_PLUS_SIGN = '+'.charCodeAt(0);

/**
 * Ampersand character (`&`).
 */
export const CHAR_AND_SIGN = '&'.charCodeAt(0);

/**
 * Tilde character (`~`).
 */
export const CHAR_TILDE = '~'.charCodeAt(0);

/**
 * Caret character (`^`).
 */
export const CHAR_CARET = '^'.charCodeAt(0);

/**
 * Dot/period character (`.`).
 */
export const CHAR_DOT = '.'.charCodeAt(0);

/**
 * Semicolon character (`;`).
 */
export const CHAR_SEMICOLON = ';'.charCodeAt(0);

/**
 * Colon character (`:`).
 */
export const CHAR_COLON = ':'.charCodeAt(0);

/**
 * Hyphen-minus character (`-`).
 */
export const CHAR_HYPHEN = '-'.charCodeAt(0);

/**
 * Less-than sign character (`<`).
 */
export const CHAR_LESS_THAN = '<'.charCodeAt(0);

/**
 * Greater-than sign character (`>`).
 */
export const CHAR_GREATER_THAN = '>'.charCodeAt(0);

/**
 * Digit zero character (`0`).
 */
export const CHAR_ZERO = '0'.charCodeAt(0);

/**
 * Digit nine character (`9`).
 */
export const CHAR_NINE = '9'.charCodeAt(0);

/**
 * Lowercase letter `a`.
 */
export const CHAR_LOWER_A = 'a'.charCodeAt(0);

/**
 * Lowercase letter `e`.
 */
export const CHAR_LOWER_E = 'e'.charCodeAt(0);

/**
 * Lowercase letter `f`.
 */
export const CHAR_LOWER_F = 'f'.charCodeAt(0);

/**
 * Uppercase letter `A`.
 */
export const CHAR_UPPER_A = 'A'.charCodeAt(0);

/**
 * Uppercase letter `E`.
 */
export const CHAR_UPPER_E = 'E'.charCodeAt(0);

/**
 * Uppercase letter `F`.
 */
export const CHAR_UPPER_F = 'F'.charCodeAt(0);

/**
 * Form feed character (`\f`).
 */
export const CHAR_FORM_FEED = '\f'.charCodeAt(0);

/**
 * Line feed character (`\n`).
 */
export const CHAR_LINE_FEED = '\n'.charCodeAt(0);

/**
 * Carriage return character (`\r`).
 */
export const CHAR_CARRIAGE_RETURN = '\r'.charCodeAt(0);
