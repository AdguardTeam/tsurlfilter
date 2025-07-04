/* eslint-disable max-len */
import {
    describe,
    test,
    expect,
    vi,
} from 'vitest';

import { CosmeticRuleParser, ERROR_MESSAGES } from '../../../src/parser/cosmetic/cosmetic-rule-parser';
import { EMPTY, SPACE } from '../../../src/utils/constants';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { CosmeticRuleGenerator } from '../../../src/generator/cosmetic';
import { CosmeticRulePatternGenerator } from '../../../src/generator/cosmetic/cosmetic-rule-pattern-generator';
import { CosmeticRuleBodyGenerator } from '../../../src/generator/cosmetic/cosmetic-rule-body-generator';
import { CosmeticRuleSerializer } from '../../../src/serializer/cosmetic/cosmetic-rule-serializer';
import { CosmeticRuleDeserializer } from '../../../src/deserializer/cosmetic/cosmetic-rule-deserializer';

describe('CosmeticRuleParser - general tests', () => {
    describe('CosmeticRuleParser.isCosmetic', () => {
        test.each([
            [EMPTY, false],
            [SPACE, false],
            ['! This is just a comment', false],
            ['# This is just a comment', false],
            ['! Title: Something', false],
            ['! example.com##.ad', false],
            ['example.com', false],
            ['||example.com', false],
            ['||example.com^$third-party', false],
            ['/ad.js^$script', false],
            ['/^regexp$/', false],
            ['@@/^regexp$/', false],

            ['##.ad', true],
            ['#@#.ad', true],
            ['##+js(something)', true],
            ['#@#+js(something)', true],
            ['##^script:has-text(antiadblock)', true],
            ['$$script[tag-content="antiadblock"]', true],
            ['$$div[custom_attr]', true],
        ])("should return '%s' for '%s'", (rule, expected) => {
            expect(CosmeticRuleParser.isCosmeticRule(rule)).toEqual(expected);
        });
    });

    describe("CosmeticRuleParser.parse - should return 'null' for non-cosmetic rules", () => {
        // Note: it parses '! example.com##.ad' as a cosmetic rule, but in the main rule parser, we handle it as a
        // comment
        test.each([
            EMPTY,
            SPACE,
            '! This is just a comment',
            '# This is just a comment',
            '! Title: Something',
            'example.com',
            '||example.com',
            '||example.com^$third-party',
            '/ad.js^$script',
            '/^regexp$/',
            '@@/^regexp$/',
            '-ad-350px-',
        ])("should return 'null' for non-cosmetic rule '%s'", (rule) => {
            expect(CosmeticRuleParser.parse(rule)).toBeNull();
        });
    });

    describe('CosmeticRuleParser.parse - should throw error for empty rule bodies', () => {
        const separators = [
            '##',
            '#@#',
            '#?#',
            '#@?#',
            '#$#',
            '#@$#',
            '#$?#',
            '#@$?#',
            '#%#',
            '#@%#',
        ];

        const domainList = 'example.com,~example.net';

        test.each([
            // empty domain list and empty body
            ...separators,
            // extra space after the separator
            ...separators.map((separator) => `${separator} `),
            // specified domain list and empty body
            ...separators.map((separator) => `${domainList}${separator}`),
            // specified domain list and extra space after the separator
            ...separators.map((separator) => `${domainList}${separator} `),
        ])("should throw error for '%s'", (actual) => {
            const fn = vi.fn(() => CosmeticRuleParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', ERROR_MESSAGES.EMPTY_RULE_BODY);
            expect(error).toHaveProperty('start', 0);
            expect(error).toHaveProperty('end', actual.length);
        });
    });

    describe('CosmeticRuleParser.generatePattern', () => {
        test.each([
            // no pattern at all
            { rule: '##.ad', expected: '' },
            // classic domain list
            { rule: 'example.com,~example.net##.ad', expected: 'example.com,~example.net' },
            // ADG modifier list + classic domain list
            { rule: '[$path=/foo/bar]example.com,~example.net##.foo', expected: '[$path=/foo/bar]example.com,~example.net' },
            // Only ADG modifier list
            { rule: '[$path=/foo/bar]##.foo', expected: '[$path=/foo/bar]' },
        ])('should generate pattern \'$expected\' from \'$rule\'', ({ rule, expected }) => {
            const ast = CosmeticRuleParser.parse(rule);

            if (ast) {
                expect(CosmeticRulePatternGenerator.generate(ast)).toEqual(expected);
            } else {
                throw new Error(`Failed to parse '${rule}'`);
            }
        });
    });

    describe('CosmeticRuleParser.generateBody', () => {
        test.each([
            // element hiding
            { rule: '##.ad', expected: '.ad' },
            { rule: '##.ad,section:contains("ad")', expected: '.ad,section:contains("ad")' },
            // CSS injection (ADG)
            { rule: '#$#* { color: red; }', expected: '* { color: red; }' },
            { rule: '#$#:contains(ad) { color: red; padding: 0 !important; }', expected: ':contains(ad) { color: red; padding: 0 !important; }' },
            // CSS injection (uBO)
            { rule: '##body:style(padding:0)', expected: 'body:style(padding:0)' },
            { rule: '##:contains(ad):style(color: red; padding: 0 !important;)', expected: ':contains(ad):style(color: red; padding: 0 !important;)' },
            // Scriptlet injection (ADG)
            { rule: '#%#//scriptlet(\'foo\', \'bar\')', expected: '//scriptlet(\'foo\', \'bar\')' },
            // Scriptlet injection (uBO)
            { rule: '##+js(foo, bar)', expected: '+js(foo, bar)' },
            // ABP snippet injection
            { rule: '#$#abp-snippet foo bar', expected: 'abp-snippet foo bar' },
            // HTML filtering (ADG)
            { rule: '$$script[tag-content="ads"]', expected: 'script[tag-content="ads"]' },
            // HTML filtering (uBO)
            { rule: '##^script:has-text(ads)', expected: '^script:has-text(ads)' },
            // JS injection (ADG)
            { rule: '#%#const a = 2;', expected: 'const a = 2;' },
        ])("should generate body '$expected' from '$rule'", ({ rule, expected }) => {
            const ast = CosmeticRuleParser.parse(rule);

            if (ast) {
                expect(CosmeticRuleBodyGenerator.generate(ast)).toEqual(expected);
            } else {
                throw new Error(`Failed to parse '${rule}'`);
            }
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            '##.ad',
            'example.com,~example.org##.ad',
            '#@#.ad',
            'example.com,~example.org#@#.ad',

            '#$#body { padding: 0; }',
            'example.com,~example.org#$#body { padding: 0; }',
            '#@$#body { padding: 0; }',
            'example.com,~example.org#@$#body { padding: 0; }',

            '#$?#:contains(ad) { color: red; padding: 0 !important; }',
            'example.com,~example.org#$?#:contains(ad) { color: red; padding: 0 !important; }',
            '#@$?#:contains(ad) { color: red; padding: 0 !important; }',
            'example.com,~example.org#@$?#:contains(ad) { color: red; padding: 0 !important; }',
            '#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',
            'example.com,~example.org#$#@media (min-height: 1024px) and (max-height: 1920px) { body { padding: 0; } }',

            "#%#//scriptlet('foo', 'bar')",
            "example.com,~example.org#%#//scriptlet('foo', 'bar')",

            '##+js(foo, bar)',
            'example.com,~example.org##+js(foo, bar)',
            '#@#+js(foo, bar)',
            'example.com,~example.org#@#+js(foo, bar)',

            '#$#scriptlet0 arg0 arg1',
            'example.com,~example.org#$#scriptlet0 arg0 arg1',
            '#@$#scriptlet0 arg0 arg1',
            'example.com,~example.org#@$#scriptlet0 arg0 arg1',

            '##^script:has-text(ads)',
            'example.com,~example.org##^script:has-text(ads)',
            '#@#^script:has-text(ads)',
            'example.com,~example.org#@#^script:has-text(ads)',

            '$$script[tag-content="ads"]',
            'example.com,~example.org$$script[tag-content="ads"]',
            '$@$script[tag-content="ads"]',
            'example.com,~example.org$@$script[tag-content="ads"]',

            // ADG modifiers
            '[$path=/foo/bar]##.foo',
            '[$path=/foo/bar]example.com,~example.org##.foo',

            // uBO modifiers
            '##:matches-path(/foo/bar) .foo',
            'example.com,~example.org##:matches-path(/foo/bar) .foo',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                CosmeticRuleParser,
                CosmeticRuleGenerator,
                CosmeticRuleSerializer,
                CosmeticRuleDeserializer,
            );
        });
    });
});
