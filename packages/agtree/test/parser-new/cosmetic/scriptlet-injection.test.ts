import { describe, expect, test } from 'vitest';

import type { ScriptletInjectionRule } from '../../../src/nodes-new';
import { RuleParser } from '../../../src/parser-new/rule-parser';
import { QuoteType } from '../../../src/utils/quotes';

const parser = new RuleParser();

describe('RuleParser — ADG scriptlet injection rules', () => {
    describe('valid ADG scriptlet rules', () => {
        test('basic scriptlet with two args', () => {
            const rule = String.raw`example.com#%#//scriptlet('scriptlet0', 'arg0')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.category).toBe('Cosmetic');
            expect(ast.syntax).toBe('AdGuard');
            expect(ast.exception).toBe(false);
            expect(ast.body.type).toBe('ScriptletInjectionRuleBody');
            expect(ast.body.children).toHaveLength(1);

            const paramList = ast.body.children[0];
            expect(paramList.type).toBe('ParameterList');
            expect(paramList.children).toHaveLength(2);
            expect(paramList.children[0]).toMatchObject({
                type: 'Parameter', quoteType: QuoteType.Single, value: 'scriptlet0',
            });
            expect(paramList.children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Single,
                value: 'arg0',
            });
        });

        test('exception rule', () => {
            const rule = String.raw`example.com#@%#//scriptlet('foo')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@%#');
        });

        test('empty scriptlet call — //scriptlet()', () => {
            const rule = String.raw`example.com#%#//scriptlet()`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(0);
        });

        test('empty scriptlet call with spaces — //scriptlet( )', () => {
            const rule = String.raw`example.com#%#//scriptlet( )`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(0);
        });

        test('single arg scriptlet', () => {
            const rule = String.raw`example.com#%#//scriptlet('foo')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(1);
            expect(ast.body.children[0].children).toHaveLength(1);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Single,
                value: 'foo',
            });
        });

        test('double-quoted parameters', () => {
            const rule = String.raw`example.com#%#//scriptlet("foo", "bar")`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(2);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Double,
                value: 'foo',
            });
            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Double,
                value: 'bar',
            });
        });

        test('escaped quotes in parameters', () => {
            const rule = String.raw`example.com#%#//scriptlet('a\'b')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Single,
                value: String.raw`a'b`,
            });
        });

        test('three args', () => {
            const rule = String.raw`example.com#%#//scriptlet('scriptlet0', 'arg0', 'arg1')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(3);
        });

        test('no domain', () => {
            const rule = String.raw`#%#//scriptlet('foo')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.domains.children).toHaveLength(0);
        });

        test('multiple domains', () => {
            const rule = String.raw`example.com,example.org#%#//scriptlet('foo')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.domains.children).toHaveLength(2);
        });

        test('whitespace after separator is skipped', () => {
            const rule = String.raw`example.com#%# //scriptlet('foo')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Single,
                value: 'foo',
            });
        });
    });

    describe('invalid ADG scriptlet rules', () => {
        test('inconsistent quotes throws', () => {
            expect(() => {
                parser.parse(String.raw`example.com#%#//scriptlet('foo', "bar")`);
            }).toThrow(/inconsistent quotes/i);
        });

        test('unquoted parameter throws', () => {
            expect(() => {
                parser.parse(String.raw`example.com#%#//scriptlet(foo)`);
            }).toThrow(/expected quote/i);
        });

        test('missing closing parenthesis throws', () => {
            expect(() => {
                parser.parse(String.raw`example.com#%#//scriptlet('foo'`);
            }).toThrow(/no closing parenthes/i);
        });

        test('whitespace after mask throws', () => {
            expect(() => {
                parser.parse(String.raw`example.com#%#//scriptlet ('foo')`);
            }).toThrow(/whitespace is not allowed after the scriptlet call mask/i);
        });

        test('unclosed parameter throws', () => {
            expect(() => {
                parser.parse(String.raw`example.com#%#//scriptlet('foo)`);
            }).toThrow(/unclosed parameter/i);
        });
    });

    describe('location info', () => {
        test('isLocIncluded provides start/end on all nodes', () => {
            const rule = String.raw`example.com#%#//scriptlet('foo')`;
            const ast = parser.parse(rule, { isLocIncluded: true }) as ScriptletInjectionRule;

            expect(ast.start).toBe(0);
            expect(ast.end).toBe(rule.length);
            expect(ast.separator.start).toBeDefined();
            expect(ast.separator.end).toBeDefined();
            expect(ast.body.start).toBeDefined();
            expect(ast.body.end).toBeDefined();
        });
    });
});

describe('RuleParser — UBO scriptlet injection rules', () => {
    describe('valid UBO scriptlet rules', () => {
        test('basic +js scriptlet', () => {
            const rule = 'example.com##+js(foo, bar)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.exception).toBe(false);
            expect(ast.separator.value).toBe('##');
            expect(ast.body.children).toHaveLength(1);
            expect(ast.body.children[0].children).toHaveLength(2);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'foo',
            });
            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'bar',
            });
        });

        test('exception rule', () => {
            const rule = 'example.com#@#+js(foo)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@#');
        });

        test('empty +js()', () => {
            const rule = 'example.com##+js()';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(0);
        });

        test('empty +js( ) with space', () => {
            const rule = 'example.com##+js( )';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(0);
        });

        test('null parameter (empty between commas)', () => {
            const rule = 'example.com##+js(a,,c)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(3);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'a',
            });
            expect(ast.body.children[0].children[1]).toBeNull();
            expect(ast.body.children[0].children[2]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'c',
            });
        });

        test('trailing comma produces null', () => {
            const rule = 'example.com##+js(a,)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(2);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'a',
            });
            expect(ast.body.children[0].children[1]).toBeNull();
        });

        test('escaped comma in argument', () => {
            const rule = String.raw`example.com##+js(scriptlet0, arg00\,arg01, arg1)`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(3);
            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: String.raw`arg00\,arg01`,
            });
        });

        test('quoted parameters', () => {
            const rule = String.raw`example.com##+js('scriptlet0', 'arg0')`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Single,
                value: 'scriptlet0',
            });
            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Single,
                value: 'arg0',
            });
        });

        test('legacy script:inject syntax', () => {
            const rule = 'example.com##script:inject(foo)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.syntax).toBe('UblockOrigin');
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'foo',
            });
        });

        test('whitespace after separator before +js', () => {
            const rule = 'example.com## +js(foo)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'foo',
            });
        });

        test('improperly quoted arg — quote treated as value part', () => {
            const rule = String.raw`example.com##+js(foo, 'bar, 'baz)`;
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(3);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'foo',
            });
            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: "'bar",
            });
            expect(ast.body.children[0].children[2]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: "'baz",
            });
        });

        test('backtick quoted parameter', () => {
            const rule = 'example.com##+js(foo, `bar`)';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.Backtick,
                value: 'bar',
            });
        });
    });

    describe('invalid UBO scriptlet rules', () => {
        test('no scriptlet name — +js(, arg) throws', () => {
            expect(() => {
                parser.parse('example.com##+js(, arg0)');
            }).toThrow(/no scriptlet name/i);
        });

        test('whitespace after mask — falls through to element hiding', () => {
            // +js (foo) does NOT match +js( prefix, so it's parsed as element hiding
            const ast = parser.parse('example.com##+js (foo)');
            expect(ast.type).toBe('ElementHidingRule');
        });

        test('missing closing parenthesis throws', () => {
            expect(() => {
                parser.parse('example.com##+js(foo');
            }).toThrow(/no closing parenthes/i);
        });
    });
});

describe('RuleParser — ABP snippet injection rules', () => {
    describe('valid ABP snippet rules', () => {
        test('basic snippet with one arg', () => {
            const rule = 'example.com#$#snippet0 arg0';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.syntax).toBe('AdblockPlus');
            expect(ast.exception).toBe(false);
            expect(ast.separator.value).toBe('#$#');
            expect(ast.body.children).toHaveLength(1);
            expect(ast.body.children[0].children).toHaveLength(2);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'snippet0',
            });
            expect(ast.body.children[0].children[1]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'arg0',
            });
        });

        test('exception rule', () => {
            const rule = 'example.com#@$#snippet0 arg0';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.exception).toBe(true);
            expect(ast.separator.value).toBe('#@$#');
        });

        test('multiple scriptlets separated by semicolon', () => {
            const rule = 'example.com#$#snippet0 arg0; snippet1';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(2);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'snippet0',
            });
            expect(ast.body.children[1].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'snippet1',
            });
        });

        test('snippet with multiple args', () => {
            const rule = 'example.com#$#snippet0 arg0 arg1 arg2';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children[0].children).toHaveLength(4);
        });

        test('snippet name only (no args)', () => {
            const rule = 'example.com#$#snippet0';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.body.children).toHaveLength(1);
            expect(ast.body.children[0].children).toHaveLength(1);
            expect(ast.body.children[0].children[0]).toMatchObject({
                type: 'Parameter',
                quoteType: QuoteType.None,
                value: 'snippet0',
            });
        });

        test('no domain', () => {
            const rule = '#$#snippet0 arg0';
            const ast = parser.parse(rule) as ScriptletInjectionRule;

            expect(ast.type).toBe('ScriptletInjectionRule');
            expect(ast.domains.children).toHaveLength(0);
        });
    });

    describe('invalid ABP snippet rules', () => {
        test('parseAbpSpecificRules=false throws', () => {
            expect(() => {
                parser.parse('example.com#$#snippet0 arg0', { parseAbpSpecificRules: false });
            }).toThrow(/ABP snippet rules are disabled/i);
        });
    });
});

// SCRIPTLET_BODY_DATA_CAPACITY = 128 slots.
// Layout: [snippetCallCount] [paramCount] [p0Start, p0End] ... so the 64th
// param write hits di = base + 128, which equals the limit and throws.

describe('ScriptletBodyPreparser — buffer overflow protection', () => {
    // Build rules with exactly N params (name counts as the first param)
    const buildAdgRule = (paramCount: number): string => {
        const params = Array.from({ length: paramCount }, (_, i) => `'p${i}'`).join(',');
        return `example.com#%#//scriptlet(${params})`;
    };

    const buildUboRule = (paramCount: number): string => {
        const params = Array.from({ length: paramCount }, (_, i) => `p${i}`).join(',');
        return `example.com##+js(${params})`;
    };

    const buildAbpRule = (paramCount: number): string => {
        const params = Array.from({ length: paramCount }, (_, i) => `p${i}`).join(' ');
        return `example.com#$#${params}`;
    };

    describe('ADG scriptlet', () => {
        test('63 params — within capacity, does not throw', () => {
            expect(() => parser.parse(buildAdgRule(63))).not.toThrow();
        });

        test('64 params — exceeds capacity, throws', () => {
            expect(() => parser.parse(buildAdgRule(64))).toThrow(
                /buffer overflow/i,
            );
        });
    });

    describe('UBO scriptlet', () => {
        test('63 params — within capacity, does not throw', () => {
            expect(() => parser.parse(buildUboRule(63))).not.toThrow();
        });

        test('64 params — exceeds capacity, throws', () => {
            expect(() => parser.parse(buildUboRule(64))).toThrow(
                /buffer overflow/i,
            );
        });
    });

    describe('ABP snippet (single call)', () => {
        test('63 space-separated tokens — within capacity, does not throw', () => {
            expect(() => parser.parse(buildAbpRule(63))).not.toThrow();
        });

        test('64 space-separated tokens — exceeds capacity, throws', () => {
            expect(() => parser.parse(buildAbpRule(64))).toThrow(
                /buffer overflow/i,
            );
        });
    });

    describe('ABP snippet (multiple calls)', () => {
        // 5 calls × (1 paramCount slot + 14 params × 2) = 5 × 29 = 145, plus 1 callCount = 146 > 128
        test('5 calls with 14 params each — exceeds capacity, throws', () => {
            const call = Array.from({ length: 14 }, (_, i) => `p${i}`).join(' ');
            const rule = `example.com#$#${Array(5).fill(call).join('; ')}`;
            expect(() => parser.parse(rule)).toThrow(/buffer overflow/i);
        });
    });
});
