import { describe, expect, test } from 'vitest';

import { defaultParserOptions, RuleParser } from '../../src/compat/rule-parser';
import { NodeType, RuleCategory } from '../../src/nodes';

describe('RuleParser compat shim', () => {
    test('parses network and cosmetic rules via the v5 pipeline', () => {
        const network = RuleParser.parse('||example.org^$third-party', {
            ...defaultParserOptions,
            isLocIncluded: false,
        });
        expect(network?.category).toBe(RuleCategory.Network);

        const cosmetic = RuleParser.parse('example.com##.ad', {
            ...defaultParserOptions,
            isLocIncluded: false,
        });
        expect(cosmetic?.category).toBe(RuleCategory.Cosmetic);
    });

    test('honors isLocIncluded', () => {
        const located = RuleParser.parse('||example.org^');
        expect(located?.start).toBe(0);
        expect(located?.end).toBe('||example.org^'.length);

        const notLocated = RuleParser.parse('||example.org^', {
            ...defaultParserOptions,
            isLocIncluded: false,
        });
        expect(notLocated?.start).toBeUndefined();
    });

    test('throws on syntactically invalid input (non-tolerant mode)', () => {
        // Unclosed ADG scriptlet call — the structural parser throws an
        // AdblockSyntaxError, which the shim must propagate.
        expect(() => RuleParser.parse('example.com#%#//scriptlet(')).toThrow();
    });

    test('tolerant mode returns an InvalidRule instead of throwing', () => {
        const result = RuleParser.parse('example.com#%#//scriptlet(', {
            ...defaultParserOptions,
            tolerant: true,
        });
        expect(result).not.toBeNull();
        expect(result!.category).toBe(RuleCategory.Invalid);
        expect(result!.type).toBe(NodeType.InvalidRule);
    });

    test('ignoreComments returns null for comment rules', () => {
        const ignored = RuleParser.parse('! comment', {
            ...defaultParserOptions,
            ignoreComments: true,
        });
        expect(ignored).toBeNull();

        const kept = RuleParser.parse('! comment', {
            ...defaultParserOptions,
            ignoreComments: false,
        });
        expect(kept?.category).toBe(RuleCategory.Comment);
    });
});
