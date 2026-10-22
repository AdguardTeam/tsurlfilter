import { describe, expect, test } from 'vitest';

import { CONVERTER_PARSE_OPTIONS, CONVERTER_PARSE_OPTIONS_RAW_HTML_BODIES } from '../../src/converter/parse-options';

describe('CONVERTER_PARSE_OPTIONS', () => {
    test('enables the detail level conversion needs', () => {
        expect(CONVERTER_PARSE_OPTIONS).toEqual({
            isLocIncluded: false,
            parseUboSpecificRules: true,
            parseAbpSpecificRules: true,
            parseHtmlFilteringRuleBodies: true,
            parseCssSelectorList: true,
            parseCssDeclarationList: true,
        });
    });

    test('raw HTML body fallback only disables HTML filtering body parsing', () => {
        expect(CONVERTER_PARSE_OPTIONS_RAW_HTML_BODIES).toEqual({
            ...CONVERTER_PARSE_OPTIONS,
            parseHtmlFilteringRuleBodies: false,
        });
    });
});
