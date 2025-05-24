import { describe, test, expect } from 'vitest';

import { DomainListParser } from '../../../src/parser/misc/domain-list-parser.js';
import {
    type DomainList,
    type DomainListSeparator,
    ListNodeType,
    ListItemNodeType,
} from '../../../src/nodes';
import { COMMA, EMPTY } from '../../../src/utils/constants.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { DomainListGenerator } from '../../../src/generator/misc/domain-list-generator.js';
import { DomainListSerializer } from '../../../src/serializer/misc/domain-list-serializer.js';
import { DomainListDeserializer } from '../../../src/deserializer/misc/domain-list-deserializer.js';

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
