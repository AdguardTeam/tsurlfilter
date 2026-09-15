import { describe, expect, test } from 'vitest';

import { CONVERTER_PARSE_OPTIONS } from '../../src/converter/parse-options';

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
});
