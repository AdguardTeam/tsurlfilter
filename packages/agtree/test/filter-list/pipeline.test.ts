import { describe, expect, test } from 'vitest';

import { FilterListPipeline } from '../../src/filter-list/pipeline';
import type { FilterListParseOptions } from '../../src/filter-list/types';
import {
    CommentRuleType,
    CosmeticRuleType,
    NetworkRuleType,
    NodeType,
    type RawRule,
    RuleCategory,
} from '../../src/nodes';

describe('FilterListPipeline', () => {
    const pipeline = new FilterListPipeline();

    test('parses a simple filter list with mixed rule types', () => {
        const source = '! comment\n||example.com^\nexample.org##.ad';
        const ast = pipeline.parse(source);

        expect(ast.type).toBe(NodeType.FilterList);
        expect(ast.children).toHaveLength(3);
        expect(ast.children[0].type).toBe(CommentRuleType.CommentRule);
        expect(ast.children[1].type).toBe(NetworkRuleType.NetworkRule);
        expect(ast.children[2].type).toBe(CosmeticRuleType.ElementHidingRule);
    });

    test('produces EmptyRule for empty lines', () => {
        const source = '||a.com^\n\n||b.com^';
        const ast = pipeline.parse(source);

        expect(ast.children).toHaveLength(3);
        expect(ast.children[0].type).toBe(NetworkRuleType.NetworkRule);
        expect(ast.children[1].type).toBe(NodeType.EmptyRule);
        expect(ast.children[2].type).toBe(NetworkRuleType.NetworkRule);
    });

    test('trailing newline produces trailing EmptyRule', () => {
        const source = '||a.com^\n';
        const ast = pipeline.parse(source);

        expect(ast.children).toHaveLength(2);
        expect(ast.children[0].type).toBe(NetworkRuleType.NetworkRule);
        expect(ast.children[1].type).toBe(NodeType.EmptyRule);
    });

    test('empty source produces single EmptyRule', () => {
        const ast = pipeline.parse('');
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0].type).toBe(NodeType.EmptyRule);
    });

    test('isLocIncluded attaches start/end to each rule', () => {
        // '||a.com^\n||b.com^'
        //  01234567 8 9     16
        const source = '||a.com^\n||b.com^';
        const opts: FilterListParseOptions = { isLocIncluded: true };
        const ast = pipeline.parse(source, opts);

        expect(ast.start).toBe(0);
        expect(ast.end).toBe(source.length);
        expect(ast.children[0].start).toBe(0);
        expect(ast.children[0].end).toBe(8);
        expect(ast.children[1].start).toBe(9);
        expect(ast.children[1].end).toBe(17);
    });

    test('tolerant mode (default) wraps syntax errors as InvalidRule', () => {
        // A rule that triggers a syntax error when parseUboSpecificRules=false
        const source = '||valid.com^\nexample.com##+js(some-scriptlet)\n! comment';
        const ast = pipeline.parse(source, { tolerant: true, parseUboSpecificRules: false });

        expect(ast.children).toHaveLength(3);
        expect(ast.children[0].type).toBe(NetworkRuleType.NetworkRule);
        expect(ast.children[1].type).toBe(NodeType.InvalidRule);
        expect(ast.children[2].type).toBe(CommentRuleType.CommentRule);
    });

    test('strict mode throws on syntax error', () => {
        const uboSource = 'example.com##+js(some-scriptlet)';
        expect(() => {
            pipeline.parse(uboSource, { tolerant: false, parseUboSpecificRules: false });
        }).toThrow();
    });

    test('reports rule errors through onParseError in tolerant mode', () => {
        const source = '||example.com^\n#%#//scriptlet(';
        const errors: Array<{ error: unknown; start: number; end: number }> = [];

        const ast = pipeline.parse(source, {
            tolerant: true,
            isLocIncluded: true,
            onParseError: (error, start, end) => {
                errors.push({ error, start, end });
            },
        });

        expect(errors).toHaveLength(1);
        expect(errors[0]!.error).toBeInstanceOf(Error);
        expect(errors[0]!.start).toBe(15);
        expect(errors[0]!.end).toBe(30);
        expect(ast.children).toHaveLength(2);
        expect(ast.children[1]!.type).toBe(NodeType.InvalidRule);
    });

    test('tolerates an unterminated quote in a CSS injection selector', () => {
        // AGLint-like options: `tolerant: true`, `isLocIncluded: true`, and
        // `parseCssSelectorList` left at its default (`false`), so the selector
        // list stays raw. The real-world unterminated-quote typo must not turn
        // the rule into an `InvalidRule`.
        const source = "example.com#$#main > div:has(> div > div > script:contains(blockId: 'R-A)) "
            + '{ position: absolute !important; top: -9999px !important; }';
        const errors: unknown[] = [];

        const ast = pipeline.parse(source, {
            tolerant: true,
            isLocIncluded: true,
            onParseError: (error) => {
                errors.push(error);
            },
        });

        expect(errors).toHaveLength(0);
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]!.type).toBe(CosmeticRuleType.CssInjectionRule);
    });

    test('tolerates an unterminated quote in an @media-wrapped CSS injection selector', () => {
        const source = "example.com#$#@media screen { main:contains(blockId: 'R-A)) "
            + '{ color: red; } }';
        const errors: unknown[] = [];

        const ast = pipeline.parse(source, { onParseError: (error) => errors.push(error) });

        expect(errors).toHaveLength(0);
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]!.type).toBe(CosmeticRuleType.CssInjectionRule);
    });

    test('keeps stray unterminated quotes outside pseudo-class arguments as ABP snippets', () => {
        // The unterminated-string tolerance is limited to `:contains(...)`
        // arguments. These `#$#` bodies must fall back to ABP snippets instead
        // of being parsed as CSS injection, and `#$?#` must stay invalid.
        const source = [
            'example.com#$#.ad " { display: none !important; }',
            "example.com#$#div[x='a { remove: true; }",
            "example.com#$#log 'hello {world}",
            "example.com#$#log 'a{b",
            'example.com#$?#.ad " { remove: true; }',
        ].join('\n');
        const errors: unknown[] = [];

        const ast = pipeline.parse(source, {
            onParseError: (error) => errors.push(error),
        });

        expect(ast.children).toHaveLength(5);
        for (let i = 0; i < 4; i += 1) {
            expect(ast.children[i]!.type).toBe(CosmeticRuleType.ScriptletInjectionRule);
        }
        expect(ast.children[4]!.type).toBe(NodeType.InvalidRule);
        expect(errors).toHaveLength(1);
    });

    test('does not detect remove: true inside a quoted declaration value', () => {
        const source = "example.com#$#.x { content: 'remove: true' }";
        const ast = pipeline.parse(source);

        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]!.type).toBe(CosmeticRuleType.CssInjectionRule);
        const { body } = ast.children[0] as { body: { remove?: boolean } };
        expect(body.remove).toBeUndefined();
    });

    test('rejects content after the CSS injection declaration block', () => {
        const source = 'example.com#$#.a { color: red } garbage';
        const errors: unknown[] = [];
        const ast = pipeline.parse(source, { onParseError: (error) => errors.push(error) });

        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]!.type).toBe(NodeType.InvalidRule);
        expect((errors[0] as Error).message).toMatch(/unexpected content/i);
    });

    test('AST builder errors are routed through onParseError', () => {
        const source = 'example.com##+js(some-scriptlet)';
        const errors: unknown[] = [];
        const ast = pipeline.parse(source, {
            tolerant: true,
            parseUboSpecificRules: false,
            onParseError: (error) => errors.push(error),
        });

        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]!.type).toBe(NodeType.InvalidRule);
        expect(errors).toHaveLength(1);
        expect((errors[0] as Error).message).toMatch(/parseUboSpecificRules/);
    });

    test('a throwing onParseError propagates out of parse()', () => {
        expect(() => pipeline.parse('#%#//scriptlet(', {
            tolerant: true,
            onParseError: () => {
                throw new Error('callback failed');
            },
        })).toThrow('callback failed');
    });

    test('capacity overflows are routed through onParseError', () => {
        const tinyPipeline = new FilterListPipeline({ tokenCapacity: 4, grow: false });
        const errors: unknown[] = [];
        const ast = tinyPipeline.parse('example.com##.ad-banner', {
            onParseError: (error) => errors.push(error),
        });

        expect(ast.children).toHaveLength(1);
        expect(ast.children[0]!.type).toBe(NodeType.InvalidRule);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(Error);
        expect((errors[0] as Error).message).toMatch(/exceeds the token capacity/i);
    });

    test('ignoreNetwork produces RawRule for network rules', () => {
        const source = '||example.com^\n! comment';
        const ast = pipeline.parse(source, { ignoreNetwork: true });

        expect(ast.children).toHaveLength(2);
        expect(ast.children[0].type).toBe(NodeType.RawRule);
        expect((ast.children[0] as RawRule).raw).toBe('||example.com^');
        expect((ast.children[0] as RawRule).kind).toBe(RuleCategory.Network);
        expect(ast.children[1].type).toBe(CommentRuleType.CommentRule);
    });

    test('ignoreCosmetic produces RawRule for cosmetic rules', () => {
        const source = 'example.org##.ad\n! comment';
        const ast = pipeline.parse(source, { ignoreCosmetic: true });

        expect(ast.children).toHaveLength(2);
        expect(ast.children[0].type).toBe(NodeType.RawRule);
        expect((ast.children[0] as RawRule).raw).toBe('example.org##.ad');
        expect((ast.children[0] as RawRule).kind).toBe(RuleCategory.Cosmetic);
        expect(ast.children[1].type).toBe(CommentRuleType.CommentRule);
    });

    test('reset() allows reuse after parsing', () => {
        const bigDomains = Array.from({ length: 200 }, (_, i) => `d${i}.com`).join(',');
        pipeline.parse(`${bigDomains}##.ad`);
        pipeline.reset();

        const ast = pipeline.parse('||example.com^');
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0].type).toBe(NetworkRuleType.NetworkRule);
    });

    test('source with only newlines produces all EmptyRules', () => {
        // '\n\n' → 3 empty rules (2 with nl + 1 trailing)
        const source = '\n\n';
        const ast = pipeline.parse(source);

        expect(ast.children).toHaveLength(3);
        for (const child of ast.children) {
            expect(child.type).toBe(NodeType.EmptyRule);
        }
    });

    test('large filter list (1000 rules) processes without error', () => {
        const lines = Array.from({ length: 1000 }, (_, i) => `||domain${i}.com^`);
        const source = lines.join('\n');
        const ast = pipeline.parse(source);

        expect(ast.children).toHaveLength(1000);
        for (const child of ast.children) {
            expect(child.type).toBe(NetworkRuleType.NetworkRule);
        }
    });

    test('isLocIncluded with empty source', () => {
        const ast = pipeline.parse('', { isLocIncluded: true });
        expect(ast.children).toHaveLength(1);
        expect(ast.children[0].start).toBe(0);
        expect(ast.children[0].end).toBe(0);
    });

    test('mixed rule categories in one filter list', () => {
        const lines = [
            '! AdGuard Base Filter',
            '||ad.example.com^',
            'example.net##.banner',
            '',
            '@@||safe.example.com^',
        ];
        const ast = pipeline.parse(lines.join('\n'));

        // 5 children: comment, network, element-hiding, empty, network
        // (no trailing newline since join('\n') doesn't add one)
        expect(ast.children).toHaveLength(5);
        expect(ast.children[0].type).toBe(CommentRuleType.CommentRule);
        expect(ast.children[1].type).toBe(NetworkRuleType.NetworkRule);
        expect(ast.children[2].type).toBe(CosmeticRuleType.ElementHidingRule);
        expect(ast.children[3].type).toBe(NodeType.EmptyRule);
        expect(ast.children[4].type).toBe(NetworkRuleType.NetworkRule);
    });

    describe('oversized rule behavior (grow:false)', () => {
        const oversizedRule = 'example.com##.ad-banner';

        test('tolerant mode: one oversized rule produces exactly one InvalidRule', () => {
            const tinyPipeline = new FilterListPipeline({ tokenCapacity: 4, grow: false });
            const ast = tinyPipeline.parse(oversizedRule);

            expect(ast.children).toHaveLength(1);
            expect(ast.children[0].type).toBe(NodeType.InvalidRule);
        });

        test('tolerant mode: oversized rule + normal rule = InvalidRule + parsed rule', () => {
            const tinyPipeline = new FilterListPipeline({ tokenCapacity: 4, grow: false });
            const ast = tinyPipeline.parse(`${oversizedRule}\n! comment`);

            expect(ast.children).toHaveLength(2);
            expect(ast.children[0].type).toBe(NodeType.InvalidRule);
            expect(ast.children[1].type).toBe(CommentRuleType.CommentRule);
        });

        test('strict mode: oversized rule throws', () => {
            const tinyPipeline = new FilterListPipeline({ tokenCapacity: 4, grow: false });

            expect(() => {
                tinyPipeline.parse(oversizedRule, { tolerant: false });
            }).toThrow();
        });

        test('two oversized rules in tolerant mode produce two InvalidRule children', () => {
            const tinyPipeline = new FilterListPipeline({ tokenCapacity: 4, grow: false });
            const ast = tinyPipeline.parse(`${oversizedRule}\n${oversizedRule}`);

            expect(ast.children).toHaveLength(2);
            expect(ast.children[0].type).toBe(NodeType.InvalidRule);
            expect(ast.children[1].type).toBe(NodeType.InvalidRule);
        });

        test('tolerant mode: form feed separates oversized rules', () => {
            // The tokenizer treats `\f` as a line break, so the capacity-overflow
            // fallback must split on it as well — otherwise both rules are
            // reported as a single error.
            const tinyPipeline = new FilterListPipeline({ tokenCapacity: 4, grow: false });
            const errors: Array<{ start: number; end: number }> = [];
            const source = 'example.com##.ad-banner\f#%#//scriptlet(';
            const ast = tinyPipeline.parse(source, {
                onParseError: (_error, start, end) => errors.push({ start, end }),
            });

            expect(ast.children).toHaveLength(2);
            expect(errors).toHaveLength(2);
            expect(errors[0]).toMatchObject({ start: 0, end: 23 });
            expect(errors[1]).toMatchObject({ start: 24, end: source.length });
        });
    });
});
