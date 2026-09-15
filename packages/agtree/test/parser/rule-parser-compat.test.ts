import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';

import { defaultParserOptions, RuleParser } from '../../src/compat/rule-parser';
import {
    type HtmlFilteringRule,
    type InvalidRule,
    NodeType,
    RuleCategory,
} from '../../src/nodes';

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

    test('applies the baseOffset argument to node locations', () => {
        const baseOffset = 42;
        const located = RuleParser.parse('||example.org^', defaultParserOptions, baseOffset);
        expect(located?.start).toBe(baseOffset);
        expect(located?.end).toBe(baseOffset + '||example.org^'.length);
    });

    test('forwards parseHtmlFilteringRuleBodies to the v5 pipeline', () => {
        const parsed = RuleParser.parse('example.com$$div[id="ad"]', {
            ...defaultParserOptions,
            parseHtmlFilteringRuleBodies: true,
        }) as HtmlFilteringRule;
        expect(parsed.category).toBe(RuleCategory.Cosmetic);
        expect(parsed.body.type).toBe(NodeType.HtmlFilteringRuleBody);

        const rawBody = RuleParser.parse('example.com$$div[id="ad"]', {
            ...defaultParserOptions,
            parseHtmlFilteringRuleBodies: false,
        }) as HtmlFilteringRule;
        expect(rawBody.body.type).toBe(NodeType.Raw);
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
        }) as InvalidRule;
        expect(result.category).toBe(RuleCategory.Invalid);
        expect(result.type).toBe(NodeType.InvalidRule);
        // The error keeps its own precise span, the outer rule the full span.
        expect(result.error.start).toBe(25);
        expect(result.error.end).toBe(26);
        expect(result.start).toBe(0);
        expect(result.end).toBe('example.com#%#//scriptlet('.length);
    });

    test('calls onParseError for parse errors caught in tolerant mode', () => {
        const onParseError = vi.fn();
        RuleParser.parse('example.com#%#//scriptlet(', {
            ...defaultParserOptions,
            tolerant: true,
            onParseError,
        });
        expect(onParseError).toHaveBeenCalledTimes(1);
    });

    test('ignoreComments returns an EmptyRule for comment rules', () => {
        const ignored = RuleParser.parse('! comment', {
            ...defaultParserOptions,
            ignoreComments: true,
        });
        expect(ignored.category).toBe(RuleCategory.Empty);
        expect(ignored.type).toBe(NodeType.EmptyRule);

        const kept = RuleParser.parse('! comment', {
            ...defaultParserOptions,
            ignoreComments: false,
        });
        expect(kept.category).toBe(RuleCategory.Comment);
    });

    test('ignoreComments short-circuits malformed comments before parsing', () => {
        // AGTree 4.2.1 returned an EmptyRule for malformed preprocessor comments
        // when they were ignored; the shim must not validate them first.
        const ignored = RuleParser.parse('!#if (adguard', {
            ...defaultParserOptions,
            ignoreComments: true,
        });
        expect(ignored.category).toBe(RuleCategory.Empty);
        expect(ignored.type).toBe(NodeType.EmptyRule);

        const tolerant = RuleParser.parse('!#if (adguard', {
            ...defaultParserOptions,
            ignoreComments: true,
            tolerant: true,
        });
        expect(tolerant.category).toBe(RuleCategory.Empty);
        expect(tolerant.type).toBe(NodeType.EmptyRule);
    });
});
