/**
 * @file Fixed parser detail level used by every converter entry point so that
 * single-rule and whole-list conversion can never disagree, and rules never
 * silently under-parse (the CSS/HTML flags default off in the parser).
 */

import { type ParseOptions } from '../ast-builder/options';

/**
 * Parser detail level required for correct conversion. Callers MUST NOT pass
 * their own parse flags — the converter owns this.
 */
export const CONVERTER_PARSE_OPTIONS: ParseOptions = {
    isLocIncluded: false,
    parseUboSpecificRules: true,
    parseAbpSpecificRules: true,
    parseHtmlFilteringRuleBodies: true,
    parseCssSelectorList: true,
    parseCssDeclarationList: true,
};
