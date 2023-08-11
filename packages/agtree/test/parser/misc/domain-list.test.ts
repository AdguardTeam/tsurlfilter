import { DomainListParser } from '../../../src/parser/misc/domain-list';
import { type DomainList, type DomainListSeparator } from '../../../src/parser/common';
import { COMMA, EMPTY } from '../../../src/utils/constants';

describe('DomainListParser', () => {
    test('parse should throw on invalid input', () => {
        expect(() => DomainListParser.parse('~')).toThrowError('Empty domain specified');

        expect(() => DomainListParser.parse('~~~')).toThrowError(
            'Exception marker cannot be followed by another exception marker',
        );

        expect(() => DomainListParser.parse(' ~ ~ ~ ')).toThrowError(
            'Exception marker cannot be followed by whitespace',
        );

        expect(() => DomainListParser.parse('~,~,~')).toThrowError(
            'Exception marker cannot be followed by a separator',
        );

        expect(() => DomainListParser.parse('~  example.com')).toThrowError(
            'Exception marker cannot be followed by whitespace',
        );

        // https://github.com/AdguardTeam/AGLint/issues/143
        expect(() => DomainListParser.parse('example.com,')).toThrowError(
            'Domain list cannot end with a separator',
        );

        expect(() => DomainListParser.parse('example.com  ,  ')).toThrowError(
            'Domain list cannot end with a separator',
        );

        expect(() => DomainListParser.parse('example.com,example.net,')).toThrowError(
            'Domain list cannot end with a separator',
        );

        expect(() => DomainListParser.parse(',')).toThrowError(
            'Domain list cannot end with a separator',
        );

        expect(() => DomainListParser.parse('example.com,,')).toThrowError(
            'Domain list cannot end with a separator',
        );

        expect(() => DomainListParser.parse('example.com , , ')).toThrowError(
            'Domain list cannot end with a separator',
        );
    });

    test('parse should work as expected on valid input', () => {
        // Empty
        expect(DomainListParser.parse(EMPTY)).toEqual<DomainList>(
            {
                type: 'DomainList',
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
                separator: ',',
                children: [],
            },
        );

        // Single domain
        expect(DomainListParser.parse('example.com')).toEqual<DomainList>(
            {
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                        },
                        value: 'example.com',
                        exception: false,
                    },
                ],
            },
        );

        // Multiple domains
        expect(DomainListParser.parse('example.com,example.net')).toEqual<DomainList>(
            {
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 23,
                        line: 1,
                        column: 24,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                        },
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 23,
                                line: 1,
                                column: 24,
                            },
                        },
                        value: 'example.net',
                        exception: false,
                    },
                ],
            },
        );

        expect(DomainListParser.parse('example.com,example.net,example.org')).toEqual<DomainList>(
            {
                type: 'DomainList',
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
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 0,
                                line: 1,
                                column: 1,
                            },
                            end: {
                                offset: 11,
                                line: 1,
                                column: 12,
                            },
                        },
                        value: 'example.com',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 23,
                                line: 1,
                                column: 24,
                            },
                        },
                        value: 'example.net',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 24,
                                line: 1,
                                column: 25,
                            },
                            end: {
                                offset: 35,
                                line: 1,
                                column: 36,
                            },
                        },
                        value: 'example.org',
                        exception: false,
                    },
                ],
            },
        );

        // Exception - single domain
        expect(DomainListParser.parse('~example.com')).toEqual<DomainList>(
            {
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 12,
                        line: 1,
                        column: 13,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'example.com',
                        exception: true,
                    },
                ],
            },
        );

        // Exception - multiple domains
        expect(DomainListParser.parse('~example.com,~example.net')).toEqual<DomainList>(
            {
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 25,
                        line: 1,
                        column: 26,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 25,
                                line: 1,
                                column: 26,
                            },
                        },
                        value: 'example.net',
                        exception: true,
                    },
                ],
            },
        );

        expect(DomainListParser.parse('~example.com,~example.net,~example.org')).toEqual<DomainList>(
            {
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 38,
                        line: 1,
                        column: 39,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 25,
                                line: 1,
                                column: 26,
                            },
                        },
                        value: 'example.net',
                        exception: true,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                            end: {
                                offset: 38,
                                line: 1,
                                column: 39,
                            },
                        },
                        value: 'example.org',
                        exception: true,
                    },
                ],
            },
        );

        // Mixed - multiple domains
        expect(DomainListParser.parse('~example.com,~example.net,example.eu,~example.org')).toEqual<DomainList>(
            {
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 49,
                        line: 1,
                        column: 50,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 14,
                                line: 1,
                                column: 15,
                            },
                            end: {
                                offset: 25,
                                line: 1,
                                column: 26,
                            },
                        },
                        value: 'example.net',
                        exception: true,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                            end: {
                                offset: 36,
                                line: 1,
                                column: 37,
                            },
                        },
                        value: 'example.eu',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 38,
                                line: 1,
                                column: 39,
                            },
                            end: {
                                offset: 49,
                                line: 1,
                                column: 50,
                            },
                        },
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
                type: 'DomainList',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 66,
                        line: 1,
                        column: 67,
                    },
                },
                separator: ',',
                children: [
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 1,
                                line: 1,
                                column: 2,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        value: 'example.com',
                        exception: true,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
                            },
                            end: {
                                offset: 26,
                                line: 1,
                                column: 27,
                            },
                        },
                        value: 'example.net',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 34,
                                line: 1,
                                column: 35,
                            },
                            end: {
                                offset: 44,
                                line: 1,
                                column: 45,
                            },
                        },
                        value: 'example.eu',
                        exception: false,
                    },
                    {
                        type: 'Domain',
                        loc: {
                            start: {
                                offset: 55,
                                line: 1,
                                column: 56,
                            },
                            end: {
                                offset: 66,
                                line: 1,
                                column: 67,
                            },
                        },
                        value: 'example.org',
                        exception: true,
                    },
                ],
            },
        );

        expect(
            DomainListParser.parse('~example.com|  example.net    |   example.eu |        ~example.org', '|'),
        ).toEqual<DomainList>({
            type: 'DomainList',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 66,
                    line: 1,
                    column: 67,
                },
            },
            separator: '|',
            children: [
                {
                    type: 'Domain',
                    loc: {
                        start: {
                            offset: 1,
                            line: 1,
                            column: 2,
                        },
                        end: {
                            offset: 12,
                            line: 1,
                            column: 13,
                        },
                    },
                    value: 'example.com',
                    exception: true,
                },
                {
                    type: 'Domain',
                    loc: {
                        start: {
                            offset: 15,
                            line: 1,
                            column: 16,
                        },
                        end: {
                            offset: 26,
                            line: 1,
                            column: 27,
                        },
                    },
                    value: 'example.net',
                    exception: false,
                },
                {
                    type: 'Domain',
                    loc: {
                        start: {
                            offset: 34,
                            line: 1,
                            column: 35,
                        },
                        end: {
                            offset: 44,
                            line: 1,
                            column: 45,
                        },
                    },
                    value: 'example.eu',
                    exception: false,
                },
                {
                    type: 'Domain',
                    loc: {
                        start: {
                            offset: 55,
                            line: 1,
                            column: 56,
                        },
                        end: {
                            offset: 66,
                            line: 1,
                            column: 67,
                        },
                    },
                    value: 'example.org',
                    exception: true,
                },
            ],
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string, separator: DomainListSeparator = COMMA) => {
            const ast = DomainListParser.parse(raw, separator);

            if (ast) {
                return DomainListParser.generate(ast);
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
});
