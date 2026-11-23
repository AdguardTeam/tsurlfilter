import { describe, expect, test } from 'vitest';

import { AdblockSyntaxError } from '../../../src/errors/adblock-syntax-error';
import { DomainListGenerator } from '../../../src/generator/misc/domain-list-generator';
import {
    type DomainList,
    type DomainListSeparator,
    ListItemNodeType,
    ListNodeType,
} from '../../../src/nodes';
import { DomainListParser } from '../../../src/parser/misc/domain-list-parser';
import { defaultParserOptions } from '../../../src/parser/options';
import { COMMA, EMPTY } from '../../../src/utils/constants';

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

        test('should parse domain list with paths', () => {
            const domain1 = 'example.com/path1';
            const domain2 = 'example.net/path2';
            const list = [domain1, domain2].join(COMMA);
            expect(DomainListParser.parse(list)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: domain1.length,
                        value: domain1,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: domain1.length + 1,
                        end: list.length,
                        value: domain2,
                        exception: false,
                    },
                ],
            });
        });

        test('should parse regex domain with escaped forward slash in path', () => {
            const regexWithPath = String.raw`/example\.org\/path1/`;
            const regularPath = 'example.org/path2';
            const list = [regexWithPath, regularPath].join(', ');
            expect(DomainListParser.parse(list)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexWithPath.length,
                        value: regexWithPath,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: regexWithPath.length + 2,
                        end: list.length,
                        value: regularPath,
                        exception: false,
                    },
                ],
            });
        });

        test('should parse regex domain with escaped forward slash in path when it is not in first position', () => {
            const regexWithPath = String.raw`/example\.org\/path1/`;
            const regularPath = 'example.org/path2';
            const list = [regularPath, regexWithPath].join(', ');
            expect(DomainListParser.parse(list)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regularPath.length,
                        value: regularPath,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: regularPath.length + 2,
                        end: list.length,
                        value: regexWithPath,
                        exception: false,
                    },
                ],
            });
        });

        test('should parse regex domain with unescaped forward slash', () => {
            const regexDomain = String.raw`/[/]/`;
            const regularPath = 'example.org/path';
            const list = [regexDomain, regularPath].join(', ');
            expect(DomainListParser.parse(list)).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: ',',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexDomain.length,
                        value: regexDomain,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: regexDomain.length + 2,
                        end: list.length,
                        value: regularPath,
                        exception: false,
                    },
                ],
            });
        });

        test('should split a regexp domain with an even backslash run before the closing delimiter', () => {
            const regexDomain = String.raw`/a\\/`;
            const list = String.raw`/a\\/|example.org`;
            expect(DomainListParser.parse(list, defaultParserOptions, 0, '|')).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexDomain.length,
                        value: regexDomain,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: regexDomain.length + 1,
                        end: list.length,
                        value: 'example.org',
                        exception: false,
                    },
                ],
            });
        });

        test('should keep a trailing regexp-like item with no closing delimiter opaque', () => {
            const regexLikeValue = String.raw`/a\/`;
            const list = String.raw`example.org|/a\/`;
            expect(DomainListParser.parse(list, defaultParserOptions, 0, '|')).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: 11,
                        value: 'example.org',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 12,
                        end: list.length,
                        value: regexLikeValue,
                        exception: false,
                    },
                ],
            });
        });

        test.each([
            String.raw`/a\|b`,
            String.raw`/a[|]b`,
            String.raw`/a(b|c)`,
            String.raw`/a(b|example.org`,
        ])('should keep a trailing regexp-like item opaque: $actual', (regexLikeValue) => {
            expect(DomainListParser.parse(regexLikeValue, defaultParserOptions, 0, '|')).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: regexLikeValue.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexLikeValue.length,
                        value: regexLikeValue,
                        exception: false,
                    },
                ],
            });
        });

        test('should split a list with a closed regexp domain in the middle', () => {
            const regexDomain = String.raw`/a\\/`;
            const list = String.raw`example.org|/a\\/|example.com`;
            expect(DomainListParser.parse(list, defaultParserOptions, 0, '|')).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: 11,
                        value: 'example.org',
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 12,
                        end: 12 + regexDomain.length,
                        value: regexDomain,
                        exception: false,
                    },
                    {
                        type: ListItemNodeType.Domain,
                        start: 13 + regexDomain.length,
                        end: list.length,
                        value: 'example.com',
                        exception: false,
                    },
                ],
            });
        });

        test('should keep a valid regexp domain with the separator inside a group as one item', () => {
            const regexDomain = String.raw`/examp[lp]e\.(com|org)/`;
            expect(DomainListParser.parse(regexDomain, defaultParserOptions, 0, '|')).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: regexDomain.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 0,
                        end: regexDomain.length,
                        value: regexDomain,
                        exception: false,
                    },
                ],
            });
        });

        test('should keep a value opaque when a later closing delimiter ends it', () => {
            const regexLikeValue = String.raw`/a\/|example.org|/b/`;
            const list = `~${regexLikeValue}`;
            expect(DomainListParser.parse(list, defaultParserOptions, 0, '|')).toEqual<DomainList>({
                type: ListNodeType.DomainList,
                start: 0,
                end: list.length,
                separator: '|',
                children: [
                    {
                        type: ListItemNodeType.Domain,
                        start: 1,
                        end: list.length,
                        value: regexLikeValue,
                        exception: true,
                    },
                ],
            });
        });

        test.each([
            {
                actual: String.raw`~/a\/|example.org`,
                start: 1,
                end: 17,
            },
            {
                actual: String.raw`/a\/|example.org`,
                start: 0,
                end: 16,
            },
            {
                actual: String.raw`~/|example.org`,
                start: 1,
                end: 14,
            },
            {
                actual: String.raw`/a\|b|example.org`,
                start: 0,
                end: 17,
            },
            {
                actual: String.raw`/a[|]b|example.org`,
                start: 0,
                end: 18,
            },
            {
                actual: String.raw`/a(b|c)|example.org`,
                start: 0,
                end: 19,
            },
            {
                actual: String.raw`/a/x|example.org`,
                start: 0,
                end: 16,
            },
        ])('should throw on an unclosed regexp literal: $actual', ({ actual, start, end }) => {
            let error: unknown;

            try {
                DomainListParser.parse(actual, defaultParserOptions, 0, '|');
            } catch (e) {
                error = e;
            }

            expect(error).toBeInstanceOf(AdblockSyntaxError);
            expect(error).toMatchObject({
                message: 'Unclosed regexp literal, no closing delimiter found',
                start,
                end,
            });
        });
    });
});
