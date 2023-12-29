import { ConfigCommentRuleParser } from '../../../src/parser/comment/inline-config';
import { EMPTY, SPACE } from '../../../src/utils/constants';

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
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 16,
                    line: 1,
                    column: 17,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                },
                value: 'aglint-disable',
            },
        });

        expect(ConfigCommentRuleParser.parse('!aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 15,
                    line: 1,
                    column: 16,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-disable',
            },
        });

        // #
        expect(ConfigCommentRuleParser.parse('# aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 16,
                    line: 1,
                    column: 17,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '#',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                },
                value: 'aglint-disable',
            },
        });

        expect(ConfigCommentRuleParser.parse('#aglint-disable')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 15,
                    line: 1,
                    column: 16,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '#',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-disable',
            },
        });

        // Different command
        expect(ConfigCommentRuleParser.parse('! aglint-enable')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 15,
                    line: 1,
                    column: 16,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-enable',
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 21,
                    line: 1,
                    column: 22,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                loc: {
                    start: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                    end: {
                        offset: 21,
                        line: 1,
                        column: 22,
                    },
                },
                children: [
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        value: 'rule1',
                    },
                ],
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1,rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 27,
                    line: 1,
                    column: 28,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                loc: {
                    start: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                    end: {
                        offset: 27,
                        line: 1,
                        column: 28,
                    },
                },
                children: [
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        value: 'rule1',
                    },
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 22,
                                line: 1,
                                column: 23,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        value: 'rule2',
                    },
                ],
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1, rule2')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 28,
                    line: 1,
                    column: 29,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                loc: {
                    start: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                    end: {
                        offset: 28,
                        line: 1,
                        column: 29,
                    },
                },
                children: [
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        value: 'rule1',
                    },
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 23,
                                line: 1,
                                column: 24,
                            },
                            end: {
                                offset: 28,
                                line: 1,
                                column: 29,
                            },
                        },
                        value: 'rule2',
                    },
                ],
            },
        });

        // Ignore comment
        expect(ConfigCommentRuleParser.parse('! aglint-enable rule1, rule2 -- comment')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 39,
                    line: 1,
                    column: 40,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 15,
                        line: 1,
                        column: 16,
                    },
                },
                value: 'aglint-enable',
            },
            params: {
                type: 'ParameterList',
                loc: {
                    start: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                    end: {
                        offset: 28,
                        line: 1,
                        column: 29,
                    },
                },
                children: [
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        value: 'rule1',
                    },
                    {
                        type: 'Parameter',
                        loc: {
                            start: {
                                offset: 23,
                                line: 1,
                                column: 24,
                            },
                            end: {
                                offset: 28,
                                line: 1,
                                column: 29,
                            },
                        },
                        value: 'rule2',
                    },
                ],
            },
            comment: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 29,
                        line: 1,
                        column: 30,
                    },
                    end: {
                        offset: 39,
                        line: 1,
                        column: 40,
                    },
                },
                value: '-- comment',
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint rule1: "off"')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 21,
                    line: 1,
                    column: 22,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 8,
                        line: 1,
                        column: 9,
                    },
                },
                value: 'aglint',
            },
            params: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 21,
                        line: 1,
                        column: 22,
                    },
                },
                value: {
                    rule1: 'off',
                },
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint rule1: 1')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 17,
                    line: 1,
                    column: 18,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 8,
                        line: 1,
                        column: 9,
                    },
                },
                value: 'aglint',
            },
            params: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 17,
                        line: 1,
                        column: 18,
                    },
                },
                value: {
                    rule1: 1,
                },
            },
        });

        expect(ConfigCommentRuleParser.parse('! aglint rule1: ["error", "double"]')).toMatchObject({
            type: 'ConfigCommentRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 35,
                    line: 1,
                    column: 36,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 8,
                        line: 1,
                        column: 9,
                    },
                },
                value: 'aglint',
            },
            params: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 35,
                        line: 1,
                        column: 36,
                    },
                },
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
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 114,
                    line: 1,
                    column: 115,
                },
            },
            category: 'Comment',
            syntax: 'Common',
            marker: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 1,
                        line: 1,
                        column: 2,
                    },
                },
                value: '!',
            },
            command: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 8,
                        line: 1,
                        column: 9,
                    },
                },
                value: 'aglint',
            },
            params: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                    end: {
                        offset: 70,
                        line: 1,
                        column: 71,
                    },
                },
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
                loc: {
                    start: {
                        offset: 71,
                        line: 1,
                        column: 72,
                    },
                    end: {
                        offset: 114,
                        line: 1,
                        column: 115,
                    },
                },
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
                        type: 'Value',
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
            expect(ConfigCommentRuleParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
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
});
