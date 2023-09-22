import { ModifierListParser } from '../../../src/parser/misc/modifier-list';
import { type ModifierList } from '../../../src/parser/common';
import { EMPTY, SPACE } from '../../../src/utils/constants';

describe('ModifierListParser', () => {
    test('parse', () => {
        // Invalid cases
        expect(() => ModifierListParser.parse(',')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse(' , ')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse(',b')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a,')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a, ')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse(' a , ')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a,,')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a,b,')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a,,b')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a , , b')).toThrowError(
            'Modifier name cannot be empty',
        );

        expect(() => ModifierListParser.parse('a=')).toThrowError(
            'Modifier value cannot be empty',
        );

        expect(() => ModifierListParser.parse('a=,b')).toThrowError(
            'Modifier value cannot be empty',
        );

        expect(() => ModifierListParser.parse('a,b=')).toThrowError(
            'Modifier value cannot be empty',
        );

        expect(() => ModifierListParser.parse('a, b = ')).toThrowError(
            'Modifier value cannot be empty',
        );

        // Empty modifiers
        expect(ModifierListParser.parse(EMPTY)).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
            },
            children: [],
        });

        expect(ModifierListParser.parse(SPACE)).toEqual<ModifierList>(
            {
                type: 'ModifierList',
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
                children: [],
            },
        );

        // Valid modifiers
        expect(ModifierListParser.parse('modifier1')).toEqual<ModifierList>(
            {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 9,
                        line: 1,
                        column: 10,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 0,
                                    line: 1,
                                    column: 1,
                                },
                                end: {
                                    offset: 9,
                                    line: 1,
                                    column: 10,
                                },
                            },
                            value: 'modifier1',
                        },
                        exception: false,
                    },
                ],
            },
        );

        expect(ModifierListParser.parse('~modifier1')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 10,
                    line: 1,
                    column: 11,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1,modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 19,
                    line: 1,
                    column: 20,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 9,
                            line: 1,
                            column: 10,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                        end: {
                            offset: 19,
                            line: 1,
                            column: 20,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                            end: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                        },
                        value: 'modifier2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1,~modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 20,
                    line: 1,
                    column: 21,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 9,
                            line: 1,
                            column: 10,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                            end: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                        },
                        value: 'modifier2',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1,modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 20,
                    line: 1,
                    column: 21,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: true,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 11,
                            line: 1,
                            column: 12,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                            end: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                        },
                        value: 'modifier2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1,~modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
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
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: true,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 11,
                            line: 1,
                            column: 12,
                        },
                        end: {
                            offset: 21,
                            line: 1,
                            column: 22,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        value: 'modifier2',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1, modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 20,
                    line: 1,
                    column: 21,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 9,
                            line: 1,
                            column: 10,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 11,
                            line: 1,
                            column: 12,
                        },
                        end: {
                            offset: 20,
                            line: 1,
                            column: 21,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                            end: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                        },
                        value: 'modifier2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1, ~modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
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
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 9,
                            line: 1,
                            column: 10,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 11,
                            line: 1,
                            column: 12,
                        },
                        end: {
                            offset: 21,
                            line: 1,
                            column: 22,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                        },
                        value: 'modifier2',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1=value1')).toEqual<ModifierList>({
            type: 'ModifierList',
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
            children: [
                {
                    type: 'Modifier',
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
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                            end: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                        },
                        value: 'value1',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1=value1')).toEqual<ModifierList>({
            type: 'ModifierList',
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
            children: [
                {
                    type: 'Modifier',
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
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        value: 'value1',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1 = value1')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 18,
                    line: 1,
                    column: 19,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 18,
                            line: 1,
                            column: 19,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 18,
                                line: 1,
                                column: 19,
                            },
                        },
                        value: 'value1',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1 = value1')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 19,
                    line: 1,
                    column: 20,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 19,
                            line: 1,
                            column: 20,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                            end: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                        },
                        value: 'value1',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('   modifier1   =    value1       ')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 33,
                    line: 1,
                    column: 34,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 3,
                            line: 1,
                            column: 4,
                        },
                        end: {
                            offset: 26,
                            line: 1,
                            column: 27,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 3,
                                line: 1,
                                column: 4,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'value1',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1,modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 26,
                    line: 1,
                    column: 27,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 9,
                            line: 1,
                            column: 10,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 10,
                            line: 1,
                            column: 11,
                        },
                        end: {
                            offset: 26,
                            line: 1,
                            column: 27,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                            end: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                        },
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 20,
                                line: 1,
                                column: 21,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'value2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1=value1,modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 33,
                    line: 1,
                    column: 34,
                },
            },
            children: [
                {
                    type: 'Modifier',
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
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                            end: {
                                offset: 16,
                                line: 1,
                                column: 17,
                            },
                        },
                        value: 'value1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 17,
                            line: 1,
                            column: 18,
                        },
                        end: {
                            offset: 33,
                            line: 1,
                            column: 34,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                            end: {
                                offset: 33,
                                line: 1,
                                column: 34,
                            },
                        },
                        value: 'value2',
                    },
                    exception: false,
                },
            ],
        });

        // Escaped separator comma
        expect(ModifierListParser.parse('modifier1=a\\,b\\,c,modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 34,
                    line: 1,
                    column: 35,
                },
            },
            children: [
                {
                    type: 'Modifier',
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
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        value: 'a\\,b\\,c',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 18,
                            line: 1,
                            column: 19,
                        },
                        end: {
                            offset: 34,
                            line: 1,
                            column: 35,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 18,
                                line: 1,
                                column: 19,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 28,
                                line: 1,
                                column: 29,
                            },
                            end: {
                                offset: 34,
                                line: 1,
                                column: 35,
                            },
                        },
                        value: 'value2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1=a\\,b\\,c,~modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
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
            children: [
                {
                    type: 'Modifier',
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
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 9,
                                line: 1,
                                column: 10,
                            },
                        },
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 10,
                                line: 1,
                                column: 11,
                            },
                            end: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                        },
                        value: 'a\\,b\\,c',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 18,
                            line: 1,
                            column: 19,
                        },
                        end: {
                            offset: 35,
                            line: 1,
                            column: 36,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                            end: {
                                offset: 28,
                                line: 1,
                                column: 29,
                            },
                        },
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 29,
                                line: 1,
                                column: 30,
                            },
                            end: {
                                offset: 35,
                                line: 1,
                                column: 36,
                            },
                        },
                        value: 'value2',
                    },
                    exception: true,
                },
            ],
        });

        expect(
            ModifierListParser.parse(
                'path=/\\/(sub1|sub2)\\/page\\.html/,replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i',
            ),
        ).toEqual<ModifierList>({
            type: 'ModifierList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 87,
                    line: 1,
                    column: 88,
                },
            },
            children: [
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 0,
                            line: 1,
                            column: 1,
                        },
                        end: {
                            offset: 32,
                            line: 1,
                            column: 33,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 4,
                                line: 1,
                                column: 5,
                            },
                        },
                        value: 'path',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 5,
                                line: 1,
                                column: 6,
                            },
                            end: {
                                offset: 32,
                                line: 1,
                                column: 33,
                            },
                        },
                        value: '/\\/(sub1|sub2)\\/page\\.html/',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    loc: {
                        start: {
                            offset: 33,
                            line: 1,
                            column: 34,
                        },
                        end: {
                            offset: 87,
                            line: 1,
                            column: 88,
                        },
                    },
                    modifier: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 33,
                                line: 1,
                                column: 34,
                            },
                            end: {
                                offset: 40,
                                line: 1,
                                column: 41,
                            },
                        },
                        value: 'replace',
                    },
                    value: {
                        type: 'Value',
                        loc: {
                            start: {
                                offset: 41,
                                line: 1,
                                column: 42,
                            },
                            end: {
                                offset: 87,
                                line: 1,
                                column: 88,
                            },
                        },
                        value: '/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i',
                    },
                    exception: false,
                },
            ],
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = ModifierListParser.parse(raw);

            if (ast) {
                return ModifierListParser.generate(ast);
            }

            return null;
        };

        expect(parseAndGenerate('modifier1')).toEqual('modifier1');
        expect(parseAndGenerate('~modifier1')).toEqual('~modifier1');
        expect(parseAndGenerate('modifier1=value1')).toEqual('modifier1=value1');
        expect(parseAndGenerate('modifier1 = value1')).toEqual('modifier1=value1');
        expect(parseAndGenerate('~modifier1=value1')).toEqual('~modifier1=value1');
        expect(parseAndGenerate('~modifier1 = value1')).toEqual('~modifier1=value1');

        expect(parseAndGenerate('modifier1=value1,modifier2')).toEqual('modifier1=value1,modifier2');
        expect(parseAndGenerate('~modifier1=value1,modifier2')).toEqual('~modifier1=value1,modifier2');
        expect(parseAndGenerate('modifier1=value1,~modifier2')).toEqual('modifier1=value1,~modifier2');
        expect(parseAndGenerate('~modifier1=value1,~modifier2')).toEqual('~modifier1=value1,~modifier2');

        expect(parseAndGenerate('modifier1 = value1, modifier2')).toEqual('modifier1=value1,modifier2');
        expect(parseAndGenerate('~modifier1 = value1, modifier2')).toEqual('~modifier1=value1,modifier2');
        expect(parseAndGenerate('modifier1 = value1, ~modifier2')).toEqual('modifier1=value1,~modifier2');
        expect(parseAndGenerate('~modifier1 = value1, ~modifier2')).toEqual('~modifier1=value1,~modifier2');

        expect(parseAndGenerate('modifier1,modifier2=value2')).toEqual('modifier1,modifier2=value2');
        expect(parseAndGenerate('modifier1, modifier2 = value2')).toEqual('modifier1,modifier2=value2');

        expect(parseAndGenerate('modifier1,modifier2')).toEqual('modifier1,modifier2');
        expect(parseAndGenerate('modifier1, modifier2')).toEqual('modifier1,modifier2');

        expect(parseAndGenerate('modifier1=value1,modifier2=value2')).toEqual('modifier1=value1,modifier2=value2');
        expect(parseAndGenerate('~modifier1=value1,~modifier2=value2')).toEqual('~modifier1=value1,~modifier2=value2');
        // eslint-disable-next-line max-len
        expect(parseAndGenerate('~modifier1  =  value1   ,   ~modifier2  =   value2')).toEqual('~modifier1=value1,~modifier2=value2');

        expect(
            parseAndGenerate(
                'path=/\\/(sub1|sub2)\\/page\\.html/,replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i',
            ),
        ).toEqual('path=/\\/(sub1|sub2)\\/page\\.html/,replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i');

        expect(
            parseAndGenerate(
                '~path=/\\/(sub1|sub2)\\/page\\.html/,replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i',
            ),
        ).toEqual('~path=/\\/(sub1|sub2)\\/page\\.html/,replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i');
    });
});
