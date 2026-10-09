/**
 * @file Fixed parser detail level used by the raw converter entry points
 * (`RawRuleConverter` / `RawFilterListConverter`) so that single-rule and
 * whole-list conversion can never disagree, and rules are parsed at the highest
 * detail the parser supports (the CSS/HTML flags default off in the parser).
 * The strict CSS sub-parsers degrade to raw selector / declaration nodes for
 * constructs they cannot parse (e.g. pseudo-element selectors, oversized
 * declaration lists), so conversion is never silently lost.
 *
 * The AST converters receive caller-parsed nodes, so their output depends on
 * the flags used to build those nodes. AST callers should parse with these
 * options for matching output.
 */

import { type ParseOptions } from '../ast-builder/options';

/**
 * Parser detail level required for correct conversion. Callers MUST NOT pass
 * their own parse flags — the converter owns this.
 *
 * The CSS flags request fully parsed selector / declaration nodes, but the AST
 * builders fall back to raw nodes when the strict CSS sub-parsers reject the
 * input, so a rule the base pipeline converted is never dropped.
 *
 * Frozen at runtime so importers cannot mutate a flag and alter every later
 * conversion.
 */
export const CONVERTER_PARSE_OPTIONS: Readonly<ParseOptions> = Object.freeze({
    isLocIncluded: false,
    parseUboSpecificRules: true,
    parseAbpSpecificRules: true,
    parseHtmlFilteringRuleBodies: true,
    parseCssSelectorList: true,
    parseCssDeclarationList: true,
});
