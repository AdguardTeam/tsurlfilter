/* eslint-disable max-len */
import { CosmeticRuleParser, ERROR_MESSAGES } from '../../../src/parser/cosmetic';
import { EMPTY, SPACE } from '../../../src/utils/constants';
import { defaultLocation } from '../../../src/parser/common';
import { locRange } from '../../../src/utils/location';
import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';

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
            const fn = jest.fn(() => CosmeticRuleParser.parse(actual));

            // parse should throw
            expect(fn).toThrow();

            // check the thrown error
            const error = fn.mock.results[0].value;
            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toHaveProperty('message', ERROR_MESSAGES.EMPTY_RULE_BODY);
            expect(error).toHaveProperty('loc', locRange(defaultLocation, 0, actual.length));
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
                expect(CosmeticRuleParser.generatePattern(ast)).toEqual(expected);
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
                expect(CosmeticRuleParser.generateBody(ast)).toEqual(expected);
            } else {
                throw new Error(`Failed to parse '${rule}'`);
            }
        });
    });
});
