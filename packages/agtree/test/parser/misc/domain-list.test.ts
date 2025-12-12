import { describe, test, expect } from 'vitest';

import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import {
    type DomainList,
    type DomainListSeparator,
    ListNodeType,
    ListItemNodeType,
} from '../../../src/nodes';
import { COMMA, EMPTY } from '../../../src/utils/constants';
import { defaultParserOptions } from '../../../src/parser/options';
import { DomainListGenerator } from '../../../src/generator/misc/domain-list-generator';
import { DomainListSerializer } from '../../../src/serializer/misc/domain-list-serializer';
import { DomainListDeserializer } from '../../../src/deserializer/misc/domain-list-deserializer';

describe('DomainListParser', () => {
    // invalid inputs are tested in `list-helpers.test.ts`

    test('parse should work as expected on valid input', () => {
        // Empty
        expect(DomainListParser.parse(EMPTY)).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 0,
                separator: ',',
                children: [],
            },
        );

        // Single domain
        expect(DomainListParser.parse('example.com')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 11,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: 11,
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
        );

        // Multiple domains
        expect(DomainListParser.parse('example.com,example.net')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 23,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: 11,
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 12,
                        end: 23,
                        value: 'example.net',
                        exception: false,
                    },
                ],
            },
        );

        expect(DomainListParser.parse('example.com,example.net,example.org')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 35,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: 11,
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 12,
                        end: 23,
                        value: 'example.net',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 24,
                        end: 35,
                        value: 'example.org',
                        exception: false,
                    },
                ],
            },
        );

        // Exception - single domain
        expect(DomainListParser.parse('~example.com')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 12,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: 12,
                        value: 'example.com',
                        exception: true,
                    },
                ],
            },
        );

        // Exception - multiple domains
        expect(DomainListParser.parse('~example.com,~example.net')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 25,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: 12,
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 14,
                        end: 25,
                        value: 'example.net',
                        exception: true,
                    },
                ],
            },
        );

        expect(DomainListParser.parse('~example.com,~example.net,~example.org')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 38,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: 12,
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 14,
                        end: 25,
                        value: 'example.net',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 27,
                        end: 38,
                        value: 'example.org',
                        exception: true,
                    },
                ],
            },
        );

        // Mixed - multiple domains
        expect(DomainListParser.parse('~example.com,~example.net,example.eu,~example.org')).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 49,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: 12,
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 14,
                        end: 25,
                        value: 'example.net',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 26,
                        end: 36,
                        value: 'example.eu',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 38,
                        end: 49,
                        value: 'example.org',
                        exception: true,
                    },
                ],
            },
        );

        // Mixed - spaces (trim)
        expect(
            DomainListParser.parse('~example.com,  example.net    ,   example.eu ,        ~example.org'),
        ).toEqual<DomainList>(
            {
                type: ListNodeType.DomainList,
                start: 0,
                end: 66,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: 12,
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 15,
                        end: 26,
                        value: 'example.net',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 34,
                        end: 44,
                        value: 'example.eu',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 55,
                        end: 66,
                        value: 'example.org',
                        exception: true,
                    },
                ],
            },
        );

        expect(
            DomainListParser.parse(
                '~example.com|  example.net    |   example.eu |        ~example.org',
                defaultParserOptions,
                0,
                '|',
            ),
        ).toEqual<DomainList>({
            type: ListNodeType.DomainList,
            start: 0,
            end: 66,
            separator: '|',
            children: [
                {
                    type: ListItemNodeType.Domain,
                    start: 1,
                    end: 12,
                    value: 'example.com',
                    exception: true,
                },
                {
                    type: ListItemNodeType.Domain,
                    start: 15,
                    end: 26,
                    value: 'example.net',
                    exception: false,
                },
                {
                    type: ListItemNodeType.Domain,
                    start: 34,
                    end: 44,
                    value: 'example.eu',
                    exception: false,
                },
                {
                    type: ListItemNodeType.Domain,
                    start: 55,
                    end: 66,
                    value: 'example.org',
                    exception: true,
                },
            ],
        });
    });

    describe('parser options should work as expected', () => {
        test.each([
            {
                actual: 'example.com',
                expected: {
                    type: ListNodeType.DomainList,
                    separator: ',',
                    children: [
                        {
                            type: ListItemNodeType.Domain,
                            value: 'example.com',
                            exception: false,
                        },
                    ],
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(DomainListParser.parse(actual, { isLocIncluded: false })).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string, separator: DomainListSeparator = COMMA) => {
            const ast = DomainListParser.parse(raw, defaultParserOptions, 0, separator);

            if (ast) {
                return DomainListGenerator.generate(ast);
            }

            return null;
        };

        expect(parseAndGenerate('example.com')).toEqual('example.com');
        expect(parseAndGenerate('~example.com')).toEqual('~example.com');

        expect(parseAndGenerate('example.com,example.org')).toEqual('example.com,example.org');
        expect(parseAndGenerate('example.com, example.org')).toEqual('example.com,example.org');
        expect(parseAndGenerate('example.com,~example.org')).toEqual('example.com,~example.org');
        expect(parseAndGenerate('example.com, ~example.org')).toEqual('example.com,~example.org');
        expect(parseAndGenerate('~example.com,~example.org')).toEqual('~example.com,~example.org');
        expect(parseAndGenerate('~example.com, ~example.org')).toEqual('~example.com,~example.org');
        expect(parseAndGenerate('~example.com,example.org,example.net')).toEqual(
            '~example.com,example.org,example.net',
        );
        expect(parseAndGenerate('~example.com, example.org, example.net')).toEqual(
            '~example.com,example.org,example.net',
        );
        expect(parseAndGenerate('~example.com|example.org|example.net', '|')).toEqual(
            '~example.com|example.org|example.net',
        );
        expect(parseAndGenerate('~example.com | example.org | example.net', '|')).toEqual(
            '~example.com|example.org|example.net',
        );
    });

    describe('regex domain patterns with special characters', () => {
        test('should parse regex domains with commas correctly', () => {
            // Single regex domain with comma in quantifier
            const singleRegex = String.raw`/example\d{1,}\.com/`;
            expect(DomainListParser.parse(singleRegex)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: singleRegex.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: singleRegex.length,
                        value: singleRegex,
                        exception: false,
                    },
                ],
            });

            // Regex domain with comma in alternation
            const regexWithAlternation = String.raw`/example\d{1,}\.(com|org)/`;
            expect(DomainListParser.parse(regexWithAlternation)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: regexWithAlternation.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexWithAlternation.length,
                        value: regexWithAlternation,
                        exception: false,
                    },
                ],
            });

            // Multiple domains with regex containing comma
            const mixedDomains = String.raw`/example\d{1,}\.com/,example.net`;
            const regexPart = String.raw`/example\d{1,}\.com/`;
            expect(DomainListParser.parse(mixedDomains)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: mixedDomains.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexPart.length,
                        value: regexPart,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: regexPart.length + 1,
                        end: mixedDomains.length,
                        value: 'example.net',
                        exception: false,
                    },
                ],
            });

            // Complex regex with multiple commas
            const complexRegex = String.raw`/^[a-z0-9]{5,}\.(?=.*[a-z])(?=.*[0-9])[a-z0-9]{17,}\.(cfd|sbs|shop)$/`;
            expect(DomainListParser.parse(complexRegex)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: complexRegex.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: complexRegex.length,
                        value: complexRegex,
                        exception: false,
                    },
                ],
            });
        });

        test('should parse regex domains with pipes correctly', () => {
            // Regex domain with pipe in alternation (comma separator)
            const regexWithPipes = String.raw`/(com|org|net)/`;
            expect(DomainListParser.parse(regexWithPipes)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: regexWithPipes.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexWithPipes.length,
                        value: regexWithPipes,
                        exception: false,
                    },
                ],
            });

            // Multiple domains with pipe separator and regex containing pipe
            const mixedWithPipeSep = String.raw`/example\.(com|org)/|example.net`;
            const regexPartPipe = String.raw`/example\.(com|org)/`;
            expect(
                DomainListParser.parse(mixedWithPipeSep, defaultParserOptions, 0, '|'),
            ).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: mixedWithPipeSep.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexPartPipe.length,
                        value: regexPartPipe,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: regexPartPipe.length + 1,
                        end: mixedWithPipeSep.length,
                        value: 'example.net',
                        exception: false,
                    },
                ],
            });
        });

        test('should parse negated regex domains with special characters', () => {
            const negatedRegex = String.raw`~/example\d{1,}\.com/`;
            const regexValue = String.raw`/example\d{1,}\.com/`;
            expect(DomainListParser.parse(negatedRegex)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: negatedRegex.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: negatedRegex.length,
                        value: regexValue,
                        exception: true,
                    },
                ],
            });

            const mixedNegated = String.raw`example.com,~/test\.(org|net)/`;
            const negatedPart = String.raw`/test\.(org|net)/`;
            expect(DomainListParser.parse(mixedNegated)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: mixedNegated.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: 11,
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 13,
                        end: mixedNegated.length,
                        value: negatedPart,
                        exception: true,
                    },
                ],
            });
        });
    });

    describe('serialize & deserialize', () => {
        test.each([
            'example.com',
            '~example.com',

            'example.com,example.org',
            'example.com,~example.org',
            '~example.com,~example.org',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                DomainListParser,
                DomainListGenerator,
                DomainListSerializer,
                DomainListDeserializer,
            );
        });
    });
});
