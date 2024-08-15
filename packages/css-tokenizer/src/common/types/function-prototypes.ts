/**
 * @file Type definitions for function prototypes
 */

import { type TokenizerContext } from '../context';
import { type TokenType } from '../enums/token-types';

/**
 * Callback which is called when a token is found
 *
 * @param type Token type
 * @param start Token start offset
 * @param end Token end offset
 * @param props Other token properties (if any)
 * @note Hash tokens have a type flag set to either "id" or "unrestricted". The type flag defaults to "unrestricted" if
 * not otherwise set
 */
export type OnTokenCallback = (type: TokenType, start: number, end: number, props?: Record<string, unknown>) => void;

/**
 * Callback which is called when a parsing error is found. According to the spec, parsing errors are not fatal and
 * therefore the tokenizer is quite permissive, but if needed, the error callback can be used.
 *
 * @param message Error message
 * @param start Error start offset
 * @param end Error end offset
 * @see {@link https://www.w3.org/TR/css-syntax-3/#error-handling}
 */
export type OnErrorCallback = (message: string, start: number, end: number) => void;

/**
 * Function handler
 *
 * @param context Reference to the tokenizer context instance
 * @param ...args Additional arguments (if any)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TokenizerContextFunction = (context: TokenizerContext, ...args: any[]) => void;
