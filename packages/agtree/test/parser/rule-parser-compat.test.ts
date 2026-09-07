import { describe, expect, test } from 'vitest';

import { defaultParserOptions, RuleParser } from '../../src/compat/rule-parser';
import { RuleCategory } from '../../src/nodes';

describe('RuleParser compat shim', () => {
    test('parses network and cosmetic rules via the v5 pipeline', () => {
        const network = RuleParser.parse('||example.org^$third-party', {
            ...defaultParserOptions,
            isLocIncluded: false,
        });
        expect(network.category).toBe(RuleCategory.Network);

        const cosmetic = RuleParser.parse('example.com##.ad', {
            ...defaultParserOptions,
            isLocIncluded: false,
        });
        expect(cosmetic.category).toBe(RuleCategory.Cosmetic);
    });

    test('honors isLocIncluded', () => {
        const located = RuleParser.parse('||example.org^');
        expect(located.start).toBe(0);
        expect(located.end).toBe('||example.org^'.length);

        const notLocated = RuleParser.parse('||example.org^', {
            ...defaultParserOptions,
            isLocIncluded: false,
        });
        expect(notLocated.start).toBeUndefined();
    });

    test('throws on syntactically invalid input (non-tolerant mode)', () => {
        // Unclosed ADG scriptlet call — the structural parser throws an
        // AdblockSyntaxError, which the shim must propagate.
        expect(() => RuleParser.parse('example.com#%#//scriptlet(')).toThrow();
    });
});
