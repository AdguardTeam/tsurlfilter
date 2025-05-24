import { describe, test, expect } from 'vitest';

import { ModifierListParser } from '../../../src/parser/misc/modifier-list.js';
import { type ModifierList } from '../../../src/nodes/index.js';
import { EMPTY, SPACE } from '../../../src/utils/constants.js';
import { ModifierListGenerator } from '../../../src/generator/misc/modifier-list-generator.js';
import { ModifierListSerializer } from '../../../src/serializer/misc/modifier-list-serializer.js';
import { ModifierListDeserializer } from '../../../src/deserializer/misc/modifier-list-deserializer.js';

describe('ModifierListParser', () => {
    test('parse', () => {
        // TODO: Refactor to test.each
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
            start: 0,
            end: 0,
            children: [],
        });

        expect(ModifierListParser.parse(SPACE)).toEqual<ModifierList>(
            {
                type: 'ModifierList',
                start: 0,
                end: 1,
                children: [],
            },
        );

        // Valid modifiers
        expect(ModifierListParser.parse('modifier1')).toEqual<ModifierList>(
            {
                type: 'ModifierList',
                start: 0,
                end: 9,
                children: [
                    {
                        type: 'Modifier',
                        start: 0,
                        end: 9,
                        name: {
                            type: 'Value',
                            start: 0,
                            end: 9,
                            value: 'modifier1',
                        },
                        exception: false,
                    },
                ],
            },
        );

        expect(ModifierListParser.parse('~modifier1')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 10,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 10,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 10,
                        value: 'modifier1',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1,modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 19,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 9,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 10,
                    end: 19,
                    name: {
                        type: 'Value',
                        start: 10,
                        end: 19,
                        value: 'modifier2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1,~modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 20,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 9,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 10,
                    end: 20,
                    name: {
                        type: 'Value',
                        start: 11,
                        end: 20,
                        value: 'modifier2',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1,modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 20,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 10,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 10,
                        value: 'modifier1',
                    },
                    exception: true,
                },
                {
                    type: 'Modifier',
                    start: 11,
                    end: 20,
                    name: {
                        type: 'Value',
                        start: 11,
                        end: 20,
                        value: 'modifier2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1,~modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 21,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 10,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 10,
                        value: 'modifier1',
                    },
                    exception: true,
                },
                {
                    type: 'Modifier',
                    start: 11,
                    end: 21,
                    name: {
                        type: 'Value',
                        start: 12,
                        end: 21,
                        value: 'modifier2',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1, modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 20,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 9,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 11,
                    end: 20,
                    name: {
                        type: 'Value',
                        start: 11,
                        end: 20,
                        value: 'modifier2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1, ~modifier2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 21,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 9,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 11,
                    end: 21,
                    name: {
                        type: 'Value',
                        start: 12,
                        end: 21,
                        value: 'modifier2',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1=value1')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 16,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 16,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 10,
                        end: 16,
                        value: 'value1',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1=value1')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 17,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 17,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 10,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 11,
                        end: 17,
                        value: 'value1',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1 = value1')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 18,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 18,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 12,
                        end: 18,
                        value: 'value1',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('~modifier1 = value1')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 19,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 19,
                    name: {
                        type: 'Value',
                        start: 1,
                        end: 10,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 13,
                        end: 19,
                        value: 'value1',
                    },
                    exception: true,
                },
            ],
        });

        expect(ModifierListParser.parse('   modifier1   =    value1       ')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 33,
            children: [
                {
                    type: 'Modifier',
                    start: 3,
                    end: 26,
                    name: {
                        type: 'Value',
                        start: 3,
                        end: 12,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 20,
                        end: 26,
                        value: 'value1',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1,modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 26,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 9,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 10,
                    end: 26,
                    name: {
                        type: 'Value',
                        start: 10,
                        end: 19,
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        start: 20,
                        end: 26,
                        value: 'value2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1=value1,modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 33,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 16,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 10,
                        end: 16,
                        value: 'value1',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 17,
                    end: 33,
                    name: {
                        type: 'Value',
                        start: 17,
                        end: 26,
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        start: 27,
                        end: 33,
                        value: 'value2',
                    },
                    exception: false,
                },
            ],
        });

        // Escaped separator comma
        expect(ModifierListParser.parse('modifier1=a\\,b\\,c,modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 34,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 17,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 10,
                        end: 17,
                        value: 'a\\,b\\,c',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 18,
                    end: 34,
                    name: {
                        type: 'Value',
                        start: 18,
                        end: 27,
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        start: 28,
                        end: 34,
                        value: 'value2',
                    },
                    exception: false,
                },
            ],
        });

        expect(ModifierListParser.parse('modifier1=a\\,b\\,c,~modifier2=value2')).toEqual<ModifierList>({
            type: 'ModifierList',
            start: 0,
            end: 35,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 17,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 9,
                        value: 'modifier1',
                    },
                    value: {
                        type: 'Value',
                        start: 10,
                        end: 17,
                        value: 'a\\,b\\,c',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 18,
                    end: 35,
                    name: {
                        type: 'Value',
                        start: 19,
                        end: 28,
                        value: 'modifier2',
                    },
                    value: {
                        type: 'Value',
                        start: 29,
                        end: 35,
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
            start: 0,
            end: 87,
            children: [
                {
                    type: 'Modifier',
                    start: 0,
                    end: 32,
                    name: {
                        type: 'Value',
                        start: 0,
                        end: 4,
                        value: 'path',
                    },
                    value: {
                        type: 'Value',
                        start: 5,
                        end: 32,
                        value: '/\\/(sub1|sub2)\\/page\\.html/',
                    },
                    exception: false,
                },
                {
                    type: 'Modifier',
                    start: 33,
                    end: 87,
                    name: {
                        type: 'Value',
                        start: 33,
                        end: 40,
                        value: 'replace',
                    },
                    value: {
                        type: 'Value',
                        start: 41,
                        end: 87,
                        value: '/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i',
                    },
                    exception: false,
                },
            ],
        });
    });

    describe('parser options should work as expected', () => {
        test.each<{ actual: string; expected: ModifierList }>([
            {
                actual: 'modifier1, ~modifier2',
                expected: {
                    type: 'ModifierList',
                    children: [
                        {
                            type: 'Modifier',
                            name: {
                                type: 'Value',
                                value: 'modifier1',
                            },
                            exception: false,
                        },
                        {
                            type: 'Modifier',
                            name: {
                                type: 'Value',
                                value: 'modifier2',
                            },
                            exception: true,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(ModifierListParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = ModifierListParser.parse(raw);

            if (ast) {
                return ModifierListGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
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

    describe('serialize & deserialize', () => {
        test.each([
            // single modifier
            'foo',
            '~foo',
            'foo=bar',
            '~foo=bar',

            // multiple modifiers
            'foo,bar',
            'foo,~bar',
            '~foo,bar',
            '~foo,~bar',

            'foo=bar,bar=foo',
            '~foo=bar,~bar=foo',
            'foo=bar,~bar=foo',
            '~foo=bar,bar=foo',

            // complicated
            'path=/\\/(sub1|sub2)\\/page\\.html/,replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/\\$1<\\/VAST>/i',
            'foo=你好,bar=世界',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                ModifierListParser,
                ModifierListGenerator,
                ModifierListSerializer,
                ModifierListDeserializer,
            );
        });
    });
});
