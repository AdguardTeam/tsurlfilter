/**
 * @file V4-compatible parser API.
 *
 * The v4 `RuleParser` / `FilterListParser` entry points live here instead of
 * in the `./parser` subpath: `./parser` is the light structural layer and must
 * not pull the AST builders, the node barrel and the walker into the module
 * graph (F-015). The package root still re-exports these names, marked
 * `@deprecated`, so existing imports keep working until `@adguard/scriptlets`
 * ships a v5 build (D-14).
 */

export { RuleParser, defaultParserOptions } from './rule-parser';
export type { LegacyParserOptions, OnParseError } from './rule-parser';
