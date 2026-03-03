import { describe, test, expect } from 'vitest';

import { tokenizeLine } from '../../src/tokenizer/tokenizer';
import type { TokenizeResult } from '../../src/tokenizer/tokenizer';
import {
    createPreparserContext,
    initPreparserContext,
    NetworkRulePreparser,
    isException,
    hasSeparator,
    getModifierCount,
    getPattern,
    getModifierName,
    getModifierValue,
    hasModifierNamed,
    findModifierIndex,
    isModifierNegated,
    hasModifierValue,
    patternEquals,
    modifierNameEquals,
    getSeparatorIndex,
} from '../../src/preparser';
import { NetworkRuleAstParser } from '../../src/parser-new';

// ── Helpers ──────────────────────────────────────────────

const createTokenResult = (capacity = 1024): TokenizeResult => ({
    tokenCount: 0,
    types: new Uint8Array(capacity),
    ends: new Uint32Array(capacity),
    actualEnd: 0,
    overflowed: 0,
});

const tokenResult = createTokenResult();
const ctx = createPreparserContext();

/**
 * Tokenize + preparse in one step for convenience.
 */
function preparse(source: string): Int32Array {
    tokenizeLine(source, 0, tokenResult);
    initPreparserContext(ctx, source, tokenResult);
    NetworkRulePreparser.preparse(ctx);
    return ctx.data;
}

describe('preparseNetworkRule', () => {
    describe('pattern-only rules (no modifiers)', () => {
        test('simple domain pattern', () => {
            const source = '||example.org^';
            const d = preparse(source);

            expect(isException(d)).toBe(false);
            expect(hasSeparator(d)).toBe(false);
            expect(getModifierCount(d)).toBe(0);
            expect(getPattern(source, d)).toBe('||example.org^');
            expect(patternEquals(source, d, '||example.org^')).toBe(true);
        });

        test('simple URL pattern', () => {
            const source = '/ads/banner.js';
            const d = preparse(source);

            expect(isException(d)).toBe(false);
            expect(hasSeparator(d)).toBe(false);
            expect(getPattern(source, d)).toBe('/ads/banner.js');
        });

        test('wildcard pattern', () => {
            const source = '*example*';
            const d = preparse(source);

            expect(getPattern(source, d)).toBe('*example*');
            expect(getModifierCount(d)).toBe(0);
        });
    });

    describe('exception rules (@@)', () => {
        test('exception rule without modifiers', () => {
            const source = '@@||example.org^';
            const d = preparse(source);

            expect(isException(d)).toBe(true);
            expect(hasSeparator(d)).toBe(false);
            expect(getPattern(source, d)).toBe('||example.org^');
        });

        test('exception rule with modifiers', () => {
            const source = '@@||example.org^$third-party,script';
            const d = preparse(source);

            expect(isException(d)).toBe(true);
            expect(hasSeparator(d)).toBe(true);
            expect(getPattern(source, d)).toBe('||example.org^');
            expect(getModifierCount(d)).toBe(2);
            expect(getModifierName(source, d, 0)).toBe('third-party');
            expect(getModifierName(source, d, 1)).toBe('script');
        });
    });

    describe('separator detection', () => {
        test('rule with single $ separator', () => {
            const source = '||example.org^$third-party';
            const d = preparse(source);

            expect(hasSeparator(d)).toBe(true);
            expect(getSeparatorIndex(d)).toBe(14);
            expect(getPattern(source, d)).toBe('||example.org^');
            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('third-party');
        });

        test('$ inside regex pattern is not a separator', () => {
            const source = '/regex$/';
            const d = preparse(source);

            // The $ is followed by / (Slash), not a modifier start
            expect(hasSeparator(d)).toBe(false);
            expect(getPattern(source, d)).toBe('/regex$/');
        });

        test('$ separator with regex modifier value', () => {
            const source = '||example.org^$removeparam=/regex$/';
            const d = preparse(source);

            expect(hasSeparator(d)).toBe(true);
            expect(getPattern(source, d)).toBe('||example.org^');
            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('removeparam');
            expect(getModifierValue(source, d, 0)).toBe('/regex$/');
        });

        test('pattern-only rule with $', () => {
            const source = '||example.org/path$value';
            const d = preparse(source);

            // $value looks like a modifier: Ident followed by EOF
            expect(hasSeparator(d)).toBe(true);
            expect(getPattern(source, d)).toBe('||example.org/path');
            expect(getModifierName(source, d, 0)).toBe('value');
        });
    });

    describe('modifier parsing', () => {
        test('single modifier without value', () => {
            const source = '||example.org^$script';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('script');
            expect(hasModifierValue(d, 0)).toBe(false);
            expect(getModifierValue(source, d, 0)).toBeNull();
            expect(isModifierNegated(d, 0)).toBe(false);
        });

        test('multiple modifiers without values', () => {
            const source = '||example.org^$third-party,script,image';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(3);
            expect(getModifierName(source, d, 0)).toBe('third-party');
            expect(getModifierName(source, d, 1)).toBe('script');
            expect(getModifierName(source, d, 2)).toBe('image');
        });

        test('modifier with value', () => {
            const source = '||example.org^$domain=example.com';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('domain');
            expect(hasModifierValue(d, 0)).toBe(true);
            expect(getModifierValue(source, d, 0)).toBe('example.com');
        });

        test('mixed modifiers with and without values', () => {
            const source = '||example.org^$third-party,domain=example.com,script';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(3);

            expect(getModifierName(source, d, 0)).toBe('third-party');
            expect(hasModifierValue(d, 0)).toBe(false);

            expect(getModifierName(source, d, 1)).toBe('domain');
            expect(getModifierValue(source, d, 1)).toBe('example.com');

            expect(getModifierName(source, d, 2)).toBe('script');
            expect(hasModifierValue(d, 2)).toBe(false);
        });

        test('negated modifier', () => {
            const source = '||example.org^$~third-party';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('third-party');
            expect(isModifierNegated(d, 0)).toBe(true);
        });

        test('mixed negated and non-negated modifiers', () => {
            const source = '||example.org^$~third-party,script,~image';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(3);

            expect(getModifierName(source, d, 0)).toBe('third-party');
            expect(isModifierNegated(d, 0)).toBe(true);

            expect(getModifierName(source, d, 1)).toBe('script');
            expect(isModifierNegated(d, 1)).toBe(false);

            expect(getModifierName(source, d, 2)).toBe('image');
            expect(isModifierNegated(d, 2)).toBe(true);
        });

        test('modifier value with pipes (domain list)', () => {
            const source = '||example.org^$domain=example.com|~example.org';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('domain');
            expect(getModifierValue(source, d, 0)).toBe('example.com|~example.org');
        });

        test('comma inside regex modifier value is not a separator', () => {
            const source = '||example.org^$removeparam=/test,value/,script';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(2);
            expect(getModifierName(source, d, 0)).toBe('removeparam');
            expect(getModifierValue(source, d, 0)).toBe('/test,value/');
            expect(getModifierName(source, d, 1)).toBe('script');
        });
    });

    describe('replace modifier (special value parsing)', () => {
        test('replace with regex value', () => {
            const source = '||example.org^$replace=/foo/bar/i';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('replace');
            expect(getModifierValue(source, d, 0)).toBe('/foo/bar/i');
        });

        test('replace with regex value followed by another modifier', () => {
            const source = '||example.org^$replace=/foo/bar/i,script';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(2);
            expect(getModifierName(source, d, 0)).toBe('replace');
            expect(getModifierValue(source, d, 0)).toBe('/foo/bar/i');
            expect(getModifierName(source, d, 1)).toBe('script');
        });

        test('replace with apostrophe-quoted value', () => {
            const source = "||example.org^$replace='text',script";
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(2);
            expect(getModifierName(source, d, 0)).toBe('replace');
            expect(getModifierValue(source, d, 0)).toBe("'text'");
            expect(getModifierName(source, d, 1)).toBe('script');
        });

        test('replace with bracket character class in regex', () => {
            const source = '||example.org^$replace=/[/]//';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('replace');
            expect(getModifierValue(source, d, 0)).toBe('/[/]//');
        });

        test('replace with empty replacement', () => {
            const source = '||example.org^$replace=/foo//';
            const d = preparse(source);

            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('replace');
            expect(getModifierValue(source, d, 0)).toBe('/foo//');
        });
    });

    describe('utility functions', () => {
        test('hasModifierNamed', () => {
            const source = '||example.org^$third-party,script';
            const d = preparse(source);

            expect(hasModifierNamed(source, d, 'third-party')).toBe(true);
            expect(hasModifierNamed(source, d, 'script')).toBe(true);
            expect(hasModifierNamed(source, d, 'image')).toBe(false);
        });

        test('findModifierIndex', () => {
            const source = '||example.org^$third-party,domain=example.com,script';
            const d = preparse(source);

            expect(findModifierIndex(source, d, 'third-party')).toBe(0);
            expect(findModifierIndex(source, d, 'domain')).toBe(1);
            expect(findModifierIndex(source, d, 'script')).toBe(2);
            expect(findModifierIndex(source, d, 'image')).toBe(-1);
        });

        test('modifierNameEquals', () => {
            const source = '||example.org^$script';
            const d = preparse(source);

            expect(modifierNameEquals(source, d, 0, 'script')).toBe(true);
            expect(modifierNameEquals(source, d, 0, 'image')).toBe(false);
        });

        test('patternEquals', () => {
            const source = '||example.org^$script';
            const d = preparse(source);

            expect(patternEquals(source, d, '||example.org^')).toBe(true);
            expect(patternEquals(source, d, '||example.com^')).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('modifiers only (empty pattern)', () => {
            const source = '$script,image';
            const d = preparse(source);

            expect(hasSeparator(d)).toBe(true);
            expect(getPattern(source, d)).toBe('');
            expect(getModifierCount(d)).toBe(2);
            expect(getModifierName(source, d, 0)).toBe('script');
            expect(getModifierName(source, d, 1)).toBe('image');
        });

        test('exception with modifiers only', () => {
            const source = '@@$script';
            const d = preparse(source);

            expect(isException(d)).toBe(true);
            expect(getPattern(source, d)).toBe('');
            expect(getModifierCount(d)).toBe(1);
            expect(getModifierName(source, d, 0)).toBe('script');
        });

        test('leading whitespace is trimmed', () => {
            const source = '  ||example.org^';
            const d = preparse(source);

            expect(getPattern(source, d)).toBe('||example.org^');
        });

        test('trailing whitespace is preserved (raw preparser)', () => {
            const source = '||example.org^  ';
            const d = preparse(source);

            expect(getPattern(source, d)).toBe('||example.org^  ');
        });

        test('buffer reuse across calls', () => {
            const source1 = '||first.org^$script';
            preparse(source1);
            expect(getPattern(source1, ctx.data)).toBe('||first.org^');
            expect(getModifierName(source1, ctx.data, 0)).toBe('script');

            const source2 = '@@||second.org^$image';
            preparse(source2);
            expect(isException(ctx.data)).toBe(true);
            expect(getPattern(source2, ctx.data)).toBe('||second.org^');
            expect(getModifierName(source2, ctx.data, 0)).toBe('image');
        });
    });

    describe('NetworkRuleAstParser.parse', () => {
        test('builds AST for simple rule', () => {
            const source = '||example.org^$third-party,script';
            const d = preparse(source);
            const ast = NetworkRuleAstParser.parse(source, d);

            expect(ast.type).toBe('NetworkRule');
            expect(ast.category).toBe('Network');
            expect(ast.exception).toBe(false);
            expect(ast.pattern.value).toBe('||example.org^');
            expect(ast.modifiers).toBeDefined();
            expect(ast.modifiers!.children).toHaveLength(2);
            expect(ast.modifiers!.children[0].name.value).toBe('third-party');
            expect(ast.modifiers!.children[1].name.value).toBe('script');
        });

        test('builds AST for exception rule', () => {
            const source = '@@||example.org^$domain=example.com';
            const d = preparse(source);
            const ast = NetworkRuleAstParser.parse(source, d);

            expect(ast.exception).toBe(true);
            expect(ast.pattern.value).toBe('||example.org^');
            expect(ast.modifiers!.children[0].name.value).toBe('domain');
            expect(ast.modifiers!.children[0].value!.value).toBe('example.com');
        });

        test('builds AST for rule without modifiers', () => {
            const source = '||example.org^';
            const d = preparse(source);
            const ast = NetworkRuleAstParser.parse(source, d);

            expect(ast.pattern.value).toBe('||example.org^');
            expect(ast.modifiers).toBeUndefined();
        });

        test('builds AST with negated modifier', () => {
            const source = '||example.org^$~third-party';
            const d = preparse(source);
            const ast = NetworkRuleAstParser.parse(source, d);

            expect(ast.modifiers!.children[0].name.value).toBe('third-party');
            expect(ast.modifiers!.children[0].exception).toBe(true);
        });

        test('builds AST with location info', () => {
            const source = '||example.org^$script';
            const d = preparse(source);
            const ast = NetworkRuleAstParser.parse(source, d, { isLocIncluded: true });

            expect(ast.start).toBe(0);
            expect(ast.end).toBe(source.length);
            expect(ast.pattern.start).toBeDefined();
            expect(ast.pattern.end).toBeDefined();
        });

        test('builds AST with raws', () => {
            const source = '||example.org^$script';
            const d = preparse(source);
            const ast = NetworkRuleAstParser.parse(source, d, { includeRaws: true });

            expect(ast.raws).toBeDefined();
            expect(ast.raws!.text).toBe(source);
        });
    });
});
