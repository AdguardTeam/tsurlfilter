import { describe, expect, test } from 'vitest';

import { NetworkRuleAstBuilder } from '../../src/ast-builder';
import {
    createParserContext,
    initParserContext,
    ModifierListParser,
    ModifierParser,
    NetworkRuleParser,
} from '../../src/parser';
import { Tokenizer } from '../../src/tokenizer/tokenizer';

const tokenizer = new Tokenizer(1024);
const ctx = createParserContext();

/**
 * Tokenize + parse in one step for convenience.
 *
 * @param source Source string to parse.
 *
 * @returns Preparsed data buffer.
 */
function parse(source: string): Int32Array {
    tokenizer.setSource(source);
    initParserContext(ctx, source, tokenizer);
    NetworkRuleParser.parse(ctx);
    return ctx.data;
}

describe('parseNetworkRule', () => {
    describe('pattern-only rules (no modifiers)', () => {
        test('simple domain pattern', () => {
            const source = '||example.org^';
            const d = parse(source);

            expect(NetworkRuleParser.isException(d)).toBe(false);
            expect(NetworkRuleParser.hasSeparator(d)).toBe(false);
            expect(ModifierListParser.getCount(d)).toBe(0);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^');
            expect(NetworkRuleParser.patternEquals(source, d, '||example.org^')).toBe(true);
        });

        test('simple URL pattern', () => {
            const source = '/ads/banner.js';
            const d = parse(source);

            expect(NetworkRuleParser.isException(d)).toBe(false);
            expect(NetworkRuleParser.hasSeparator(d)).toBe(false);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('/ads/banner.js');
        });

        test('wildcard pattern', () => {
            const source = '*example*';
            const d = parse(source);

            expect(NetworkRuleParser.getPattern(source, d)).toBe('*example*');
            expect(ModifierListParser.getCount(d)).toBe(0);
        });
    });

    describe('exception rules (@@)', () => {
        test('exception rule without modifiers', () => {
            const source = '@@||example.org^';
            const d = parse(source);

            expect(NetworkRuleParser.isException(d)).toBe(true);
            expect(NetworkRuleParser.hasSeparator(d)).toBe(false);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^');
        });

        test('exception rule with modifiers', () => {
            const source = '@@||example.org^$third-party,script';
            const d = parse(source);

            expect(NetworkRuleParser.isException(d)).toBe(true);
            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^');
            expect(ModifierListParser.getCount(d)).toBe(2);
            expect(ModifierParser.getName(source, d, 0)).toBe('third-party');
            expect(ModifierParser.getName(source, d, 1)).toBe('script');
        });
    });

    describe('separator detection', () => {
        test('rule with single $ separator', () => {
            const source = '||example.org^$third-party';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getSeparatorIndex(d)).toBe(14);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^');
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('third-party');
        });

        test('$ inside regex pattern is not a separator', () => {
            const source = '/regex$/';
            const d = parse(source);

            // The $ is followed by / (Slash), not a modifier start
            expect(NetworkRuleParser.hasSeparator(d)).toBe(false);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('/regex$/');
        });

        test('$ separator with regex modifier value', () => {
            const source = '||example.org^$removeparam=/regex$/';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^');
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('removeparam');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/regex$/');
        });

        test('$ at end of non-regex modifier value is not a separator', () => {
            const source = '||example.com^$removeparam=id$';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.com^');
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('removeparam');
            expect(ModifierParser.getValue(source, d, 0)).toBe('id$');
        });

        test('escaped $ inside regex modifier value', () => {
            const source = '||example.com^$removeparam=/^id\\$$/';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.com^');
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('removeparam');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/^id\\$$/');
        });

        test('complex regex with $ end anchor in modifier value', () => {
            // Real-world rule: $ at end is a regex end anchor, not a rule separator
            const source = '||www.amazon.$removeparam=/^[a-z_]{1,20}=[a-zA-Z0-9._-]{80,}$/';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||www.amazon.');
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('removeparam');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/^[a-z_]{1,20}=[a-zA-Z0-9._-]{80,}$/');
        });

        test('pattern-only rule with $', () => {
            const source = '||example.org/path$value';
            const d = parse(source);

            // $value looks like a modifier: Ident followed by EOF
            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org/path');
            expect(ModifierParser.getName(source, d, 0)).toBe('value');
        });
    });

    describe('modifier parsing', () => {
        test('single modifier without value', () => {
            const source = '||example.org^$script';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('script');
            expect(ModifierParser.hasValue(d, 0)).toBe(false);
            expect(ModifierParser.getValue(source, d, 0)).toBeNull();
            expect(ModifierParser.isNegated(d, 0)).toBe(false);
        });

        test('multiple modifiers without values', () => {
            const source = '||example.org^$third-party,script,image';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(3);
            expect(ModifierParser.getName(source, d, 0)).toBe('third-party');
            expect(ModifierParser.getName(source, d, 1)).toBe('script');
            expect(ModifierParser.getName(source, d, 2)).toBe('image');
        });

        test('modifier with value', () => {
            const source = '||example.org^$domain=example.com';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('domain');
            expect(ModifierParser.hasValue(d, 0)).toBe(true);
            expect(ModifierParser.getValue(source, d, 0)).toBe('example.com');
        });

        test('mixed modifiers with and without values', () => {
            const source = '||example.org^$third-party,domain=example.com,script';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(3);

            expect(ModifierParser.getName(source, d, 0)).toBe('third-party');
            expect(ModifierParser.hasValue(d, 0)).toBe(false);

            expect(ModifierParser.getName(source, d, 1)).toBe('domain');
            expect(ModifierParser.getValue(source, d, 1)).toBe('example.com');

            expect(ModifierParser.getName(source, d, 2)).toBe('script');
            expect(ModifierParser.hasValue(d, 2)).toBe(false);
        });

        test('negated modifier', () => {
            const source = '||example.org^$~third-party';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('third-party');
            expect(ModifierParser.isNegated(d, 0)).toBe(true);
        });

        test('mixed negated and non-negated modifiers', () => {
            const source = '||example.org^$~third-party,script,~image';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(3);

            expect(ModifierParser.getName(source, d, 0)).toBe('third-party');
            expect(ModifierParser.isNegated(d, 0)).toBe(true);

            expect(ModifierParser.getName(source, d, 1)).toBe('script');
            expect(ModifierParser.isNegated(d, 1)).toBe(false);

            expect(ModifierParser.getName(source, d, 2)).toBe('image');
            expect(ModifierParser.isNegated(d, 2)).toBe(true);
        });

        test('modifier value with pipes (domain list)', () => {
            const source = '||example.org^$domain=example.com|~example.org';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('domain');
            expect(ModifierParser.getValue(source, d, 0)).toBe('example.com|~example.org');
        });

        test('comma inside regex modifier value is not a separator', () => {
            const source = '||example.org^$removeparam=/test,value/,script';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(2);
            expect(ModifierParser.getName(source, d, 0)).toBe('removeparam');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/test,value/');
            expect(ModifierParser.getName(source, d, 1)).toBe('script');
        });

        test('noop modifier $_ is not dropped', () => {
            const source = '||example.org^$_';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('_');
        });

        test('noop modifier $___ is not dropped', () => {
            const source = '||example.org^$___';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('___');
        });

        test('noop modifier $_invalid_ with mixed modifiers survives', () => {
            const source = '||example.org^$_invalid_,script';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(ModifierListParser.getCount(d)).toBe(2);
            expect(ModifierParser.getName(source, d, 0)).toBe('_invalid_');
            expect(ModifierParser.getName(source, d, 1)).toBe('script');
        });
    });

    describe('replace modifier (special value parsing)', () => {
        test('replace with regex value', () => {
            const source = '||example.org^$replace=/foo/bar/i';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('replace');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/foo/bar/i');
        });

        test('replace with regex value followed by another modifier', () => {
            const source = '||example.org^$replace=/foo/bar/i,script';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(2);
            expect(ModifierParser.getName(source, d, 0)).toBe('replace');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/foo/bar/i');
            expect(ModifierParser.getName(source, d, 1)).toBe('script');
        });

        test('replace with apostrophe-quoted value', () => {
            const source = "||example.org^$replace='text',script";
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(2);
            expect(ModifierParser.getName(source, d, 0)).toBe('replace');
            expect(ModifierParser.getValue(source, d, 0)).toBe("'text'");
            expect(ModifierParser.getName(source, d, 1)).toBe('script');
        });

        test('replace with bracket character class in regex', () => {
            const source = '||example.org^$replace=/[/]//';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('replace');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/[/]//');
        });

        test('replace with empty replacement', () => {
            const source = '||example.org^$replace=/foo//';
            const d = parse(source);

            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('replace');
            expect(ModifierParser.getValue(source, d, 0)).toBe('/foo//');
        });
    });

    describe('utility functions', () => {
        test('hasModifierNamed', () => {
            const source = '||example.org^$third-party,script';
            const d = parse(source);

            expect(ModifierListParser.hasNamed(source, d, 'third-party')).toBe(true);
            expect(ModifierListParser.hasNamed(source, d, 'script')).toBe(true);
            expect(ModifierListParser.hasNamed(source, d, 'image')).toBe(false);
        });

        test('findModifierIndex', () => {
            const source = '||example.org^$third-party,domain=example.com,script';
            const d = parse(source);

            expect(ModifierListParser.findIndex(source, d, 'third-party')).toBe(0);
            expect(ModifierListParser.findIndex(source, d, 'domain')).toBe(1);
            expect(ModifierListParser.findIndex(source, d, 'script')).toBe(2);
            expect(ModifierListParser.findIndex(source, d, 'image')).toBe(-1);
        });

        test('modifierNameEquals', () => {
            const source = '||example.org^$script';
            const d = parse(source);

            expect(ModifierParser.nameEquals(source, d, 0, 'script')).toBe(true);
            expect(ModifierParser.nameEquals(source, d, 0, 'image')).toBe(false);
        });

        test('patternEquals', () => {
            const source = '||example.org^$script';
            const d = parse(source);

            expect(NetworkRuleParser.patternEquals(source, d, '||example.org^')).toBe(true);
            expect(NetworkRuleParser.patternEquals(source, d, '||example.com^')).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('modifiers only (empty pattern)', () => {
            const source = '$script,image';
            const d = parse(source);

            expect(NetworkRuleParser.hasSeparator(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('');
            expect(ModifierListParser.getCount(d)).toBe(2);
            expect(ModifierParser.getName(source, d, 0)).toBe('script');
            expect(ModifierParser.getName(source, d, 1)).toBe('image');
        });

        test('exception with modifiers only', () => {
            const source = '@@$script';
            const d = parse(source);

            expect(NetworkRuleParser.isException(d)).toBe(true);
            expect(NetworkRuleParser.getPattern(source, d)).toBe('');
            expect(ModifierListParser.getCount(d)).toBe(1);
            expect(ModifierParser.getName(source, d, 0)).toBe('script');
        });

        test('leading whitespace is trimmed', () => {
            const source = '  ||example.org^';
            const d = parse(source);

            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^');
        });

        test('trailing whitespace is preserved (raw parser)', () => {
            const source = '||example.org^  ';
            const d = parse(source);

            expect(NetworkRuleParser.getPattern(source, d)).toBe('||example.org^  ');
        });

        test('buffer reuse across calls', () => {
            const source1 = '||first.org^$script';
            parse(source1);
            expect(NetworkRuleParser.getPattern(source1, ctx.data)).toBe('||first.org^');
            expect(ModifierParser.getName(source1, ctx.data, 0)).toBe('script');

            const source2 = '@@||second.org^$image';
            parse(source2);
            expect(NetworkRuleParser.isException(ctx.data)).toBe(true);
            expect(NetworkRuleParser.getPattern(source2, ctx.data)).toBe('||second.org^');
            expect(ModifierParser.getName(source2, ctx.data, 0)).toBe('image');
        });
    });

    describe('NetworkRuleAstBuilder.parse', () => {
        test('builds AST for simple rule', () => {
            const source = '||example.org^$third-party,script';
            const d = parse(source);
            const ast = NetworkRuleAstBuilder.parse(source, d);

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
            const d = parse(source);
            const ast = NetworkRuleAstBuilder.parse(source, d);

            expect(ast.exception).toBe(true);
            expect(ast.pattern.value).toBe('||example.org^');
            expect(ast.modifiers!.children[0].name.value).toBe('domain');
            expect(ast.modifiers!.children[0].value!.value).toBe('example.com');
        });

        test('builds AST for rule without modifiers', () => {
            const source = '||example.org^';
            const d = parse(source);
            const ast = NetworkRuleAstBuilder.parse(source, d);

            expect(ast.pattern.value).toBe('||example.org^');
            expect(ast.modifiers).toBeUndefined();
        });

        test('builds AST with negated modifier', () => {
            const source = '||example.org^$~third-party';
            const d = parse(source);
            const ast = NetworkRuleAstBuilder.parse(source, d);

            expect(ast.modifiers!.children[0].name.value).toBe('third-party');
            expect(ast.modifiers!.children[0].exception).toBe(true);
        });

        test('builds AST with location info', () => {
            const source = '||example.org^$script';
            const d = parse(source);
            const ast = NetworkRuleAstBuilder.parse(source, d, 0, { isLocIncluded: true });

            expect(ast.start).toBe(0);
            expect(ast.end).toBe(source.length);
            expect(ast.pattern.start).toBeDefined();
            expect(ast.pattern.end).toBeDefined();
        });
    });
});
