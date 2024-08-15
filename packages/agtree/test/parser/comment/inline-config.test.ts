import { ConfigCommentRuleParser } from '../../../src/parser/comment/inline-config';
import { EMPTY, SPACE } from '../../../src/utils/constants';
import { defaultParserOptions } from '../../../src/parser/options';

describe('ConfigCommentRuleParser', () => {
    test('isConfigComment', () => {
        // TODO: Refactor to test.each
        // Empty
        expect(ConfigCommentRuleParser.isConfigComment(EMPTY)).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment(SPACE)).toBeFalsy();

        // Begins with !
        expect(ConfigCommentRuleParser.isConfigComment('!')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!!')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('! comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!+comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!#comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!#########################')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('! #########################')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment(' !')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('  !')).toBeFalsy();

        // Begins with #
        expect(ConfigCommentRuleParser.isConfigComment('#')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('##')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('# #')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('# comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#+comment')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#########################')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('# ########################')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment(' #')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('  ##')).toBeFalsy();

        // Not "aglint" prefix
        expect(ConfigCommentRuleParser.isConfigComment('!aaglint')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!aaglint-enable')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!aaglint-anything')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('! aaglint')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('! aaglint-enable')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('! aaglint-anything')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!   aaglint  ')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!   aaglint-enable  ')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('!   aaglint-anything  ')).toBeFalsy();

        expect(ConfigCommentRuleParser.isConfigComment('#aaglint')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#aaglint-enable')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#aaglint-anything')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('# aaglint')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('# aaglint-enable')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('# aaglint-anything')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#   aaglint  ')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#   aaglint-enable  ')).toBeFalsy();
        expect(ConfigCommentRuleParser.isConfigComment('#   aaglint-anything  ')).toBeFalsy();

        // Valid cases
        expect(ConfigCommentRuleParser.isConfigComment('!aglint')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('!aglint-enable')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('!aglint-anything')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('! aglint')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('! aglint-enable')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('! aglint-anything')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('!   aglint  ')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('!   aglint-enable  ')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('!   aglint-anything  ')).toBeTruthy();

        expect(ConfigCommentRuleParser.isConfigComment('#aglint')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('#aglint-enable')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('#aglint-anything')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('# aglint')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('# aglint-enable')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('# aglint-anything')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('#   aglint  ')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('#   aglint-enable  ')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('#   aglint-anything  ')).toBeTruthy();

        expect(ConfigCommentRuleParser.isConfigComment('!AGLINT')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('#AGLINT')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('! AGLINT')).toBeTruthy();
        expect(ConfigCommentRuleParser.isConfigComment('# AGLINT')).toBeTruthy();
    });

    test('parse', () => {
        // TODO: Refactor to test.each
        // !
        expect(ConfigCommentRuleParser.parse('! aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 16,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 16,
                value: 'aglint-disable',
            },
        });

        expect(ConfigCommentRuleParser.parse('!aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 1,
                end: 15,
                value: 'aglint-disable',
            },
        });

        // #
        expect(ConfigCommentRuleParser.parse('# aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 16,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 16,
                value: 'aglint-disable',
            },
        });

        expect(ConfigCommentRuleParser.parse('#aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '#',
            },
            command: {
                type: 'Value',
                start: 1,
                end: 15,
                value: 'aglint-disable',
            },
        });

        // Different command
        expect(ConfigCommentRuleParser.parse('! aglint-enable')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 15,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 21,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                start: 16,
                end: 21,
                children: [
                    {
                        type: 'Value',
                        start: 16,
                        end: 21,
                        value: 'rule1',
                    },
                ],
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1,rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 27,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                start: 16,
                end: 27,
                children: [
                    {
                        type: 'Value',
                        start: 16,
                        end: 21,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 22,
                        end: 27,
                        value: 'rule2',
                    },
                ],
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1, rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 28,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                start: 16,
                end: 28,
                children: [
                    {
                        type: 'Value',
                        start: 16,
                        end: 21,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 23,
                        end: 28,
                        value: 'rule2',
                    },
                ],
            },
        });

        // Ignore comment
        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1, rule2 -- comment')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 39,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 15,
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                start: 16,
                end: 28,
                children: [
                    {
                        type: 'Value',
                        start: 16,
                        end: 21,
                        value: 'rule1',
                    },
                    {
                        type: 'Value',
                        start: 23,
                        end: 28,
                        value: 'rule2',
                    },
                ],
            },
            comment: {
                type: 'Value',
                start: 29,
                end: 39,
                value: '-- comment',
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint rule1: "off"')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 21,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 8,
                value: 'aglint',
            },
            params: {
                type: 'ConfigNode',
                start: 9,
                end: 21,
                value: {
                    rule1: 'off',
                },
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint rule1: 1')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 17,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 8,
                value: 'aglint',
            },
            params: {
                type: 'ConfigNode',
                start: 9,
                end: 17,
                value: {
                    rule1: 1,
                },
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint rule1: ["error", "double"]')).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 35,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 8,
                value: 'aglint',
            },
            params: {
                type: 'ConfigNode',
                start: 9,
                end: 35,
                value: {
                    rule1: [
                        'error',
                        'double',
                    ],
                },
            },
        });

        // Complicated case
        expect(
            ConfigCommentRuleParser.parse(
                // eslint-disable-next-line max-len
                '! aglint rule1: "off", rule2: [1, 2], rule3: ["error", { "max": 100 }] -- this is a comment -- this doesn\'t matter',
            ),
        ).toMatchObject({
            type: 'ConfigCommentRule',
            start: 0,
            end: 114,
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                start: 0,
                end: 1,
                value: '!',
            },
            command: {
                type: 'Value',
                start: 2,
                end: 8,
                value: 'aglint',
            },
            params: {
                type: 'ConfigNode',
                start: 9,
                end: 70,
                value: {
                    rule1: 'off',
                    rule2: [
                        1,
                        2,
                    ],
                    rule3: [
                        'error',
                        {
                            max: 100,
                        },
                    ],
                },
            },
            comment: {
                type: 'Value',
                start: 71,
                end: 114,
                value: "-- this is a comment -- this doesn't matter",
            },
        });

        // TODO: Refactor to test.each
        // Invalid cases
        expect(() => ConfigCommentRuleParser.parse('! aglint')).toThrowError('Empty AGLint config');
        expect(() => ConfigCommentRuleParser.parse('! aglint rule1')).toThrowError();
        expect(() => ConfigCommentRuleParser.parse('! aglint rule1: ["error", "double"')).toThrowError();
        expect(() => ConfigCommentRuleParser.parse('! aglint rule1: () => 1')).toThrowError();

        expect(() => ConfigCommentRuleParser.parse('# aglint')).toThrowError('Empty AGLint config');
        expect(() => ConfigCommentRuleParser.parse('# aglint rule1')).toThrowError();
        expect(() => ConfigCommentRuleParser.parse('# aglint rule1: ["error", "double"')).toThrowError();
        expect(() => ConfigCommentRuleParser.parse('# aglint rule1: () => 1')).toThrowError();
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                // eslint-disable-next-line max-len
                actual: '! aglint rule1: "off", rule2: [1, 2], rule3: ["error", { "max": 100 }] -- this is a comment -- this doesn\'t matter',
                expected: {
                    type: 'ConfigCommentRule',
                    category: 'Comment',
                    syntax: 'Common',
                    raws: {
                        // eslint-disable-next-line max-len
                        text: '! aglint rule1: "off", rule2: [1, 2], rule3: ["error", { "max": 100 }] -- this is a comment -- this doesn\'t matter',
                    },
                    marker: {
                        type: 'Value',
                        value: '!',
                    },
                    command: {
                        type: 'Value',
                        value: 'aglint',
                    },
                    params: {
                        type: 'ConfigNode',
                        value: {
                            rule1: 'off',
                            rule2: [
                                1,
                                2,
                            ],
                            rule3: [
                                'error',
                                {
                                    max: 100,
                                },
                            ],
                        },
                    },
                    comment: {
                        type: 'Value',
                        value: "-- this is a comment -- this doesn't matter",
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                ConfigCommentRuleParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = ConfigCommentRuleParser.parse(raw);

            if (ast) {
                return ConfigCommentRuleParser.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('! aglint rule1: ["error", "double"]')).toEqual('! aglint "rule1":["error","double"]');
        expect(parseAndGenerate('! aglint rule1: ["error", "double"] -- comment')).toEqual(
            '! aglint "rule1":["error","double"] -- comment',
        );

        expect(parseAndGenerate('! aglint-disable rule1, rule2')).toEqual('! aglint-disable rule1, rule2');
        expect(parseAndGenerate('! aglint-disable rule1, rule2 -- comment')).toEqual(
            '! aglint-disable rule1, rule2 -- comment',
        );
    });

    describe('serialize & deserialize', () => {
        test.each([
            '! aglint-disable-next-line',
            '! aglint-disable-next-line -- comment',
            '! aglint-disable-next-line rule1',
            '! aglint-disable-next-line rule1 -- comment',
            '! aglint-disable-next-line rule1, rule2',
            '! aglint-disable-next-line rule1, rule2 -- comment',
            // complex case
            // eslint-disable-next-line max-len
            '! aglint rule1: "off", rule2: [1, 2], rule3: ["error", { "max": 100 }] -- this is a comment -- this doesn\'t matter',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(ConfigCommentRuleParser);
        });
    });
});
