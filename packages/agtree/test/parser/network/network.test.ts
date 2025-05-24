import { describe, test, expect } from 'vitest';

import { NetworkRuleParser } from '../../../src/parser/network/network-rule-parser.js';
import { AdblockSyntax } from '../../../src/utils/adblockers.js';
import { type NetworkRule, RuleCategory, NetworkRuleType } from '../../../src/nodes/index.js';
import { defaultParserOptions } from '../../../src/parser/options.js';
import { NetworkRuleGenerator } from '../../../src/generator/network/index.js';
import { NetworkRuleSerializer } from '../../../src/serializer/network/network-rule-serializer.js';
import { NetworkRuleDeserializer } from '../../../src/deserializer/network/network-rule-deserializer.js';

describe('NetworkRuleParser', () => {
    test('parse', () => {
        // TODO: Refactor to test.each
        expect(NetworkRuleParser.parse('||example.com')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 13,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 13,
                value: '||example.com',
            },
        });

        expect(NetworkRuleParser.parse('@@||example.com')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 15,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 15,
                value: '||example.com',
            },
        });

        expect(NetworkRuleParser.parse('@@||example.com$m1,m2=v2')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 24,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 15,
                value: '||example.com',
            },
            modifiers: {
                type: 'ModifierList',
                start: 16,
                end: 24,
                children: [
                    {
                        type: 'Modifier',
                        start: 16,
                        end: 18,
                        name: {
                            type: 'Value',
                            start: 16,
                            end: 18,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 19,
                        end: 24,
                        name: {
                            type: 'Value',
                            start: 19,
                            end: 21,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 22,
                            end: 24,
                            value: 'v2',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('/example/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 9,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 9,
                value: '/example/',
            },
        });

        expect(NetworkRuleParser.parse('@@/example/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 11,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 11,
                value: '/example/',
            },
        });

        expect(NetworkRuleParser.parse('@@/example/$m1,m2=v2')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 20,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 11,
                value: '/example/',
            },
            modifiers: {
                type: 'ModifierList',
                start: 12,
                end: 20,
                children: [
                    {
                        type: 'Modifier',
                        start: 12,
                        end: 14,
                        name: {
                            type: 'Value',
                            start: 12,
                            end: 14,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 15,
                        end: 20,
                        name: {
                            type: 'Value',
                            start: 15,
                            end: 17,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 18,
                            end: 20,
                            value: 'v2',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Last $ in regex pattern
        expect(NetworkRuleParser.parse('@@/example/$m1,m2=v2,m3=/^r3$/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 30,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 11,
                value: '/example/',
            },
            modifiers: {
                type: 'ModifierList',
                start: 12,
                end: 30,
                children: [
                    {
                        type: 'Modifier',
                        start: 12,
                        end: 14,
                        name: {
                            type: 'Value',
                            start: 12,
                            end: 14,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 15,
                        end: 20,
                        name: {
                            type: 'Value',
                            start: 15,
                            end: 17,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 18,
                            end: 20,
                            value: 'v2',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 21,
                        end: 30,
                        name: {
                            type: 'Value',
                            start: 21,
                            end: 23,
                            value: 'm3',
                        },
                        value: {
                            type: 'Value',
                            start: 24,
                            end: 30,
                            value: '/^r3$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Escaped $ in regex
        expect(NetworkRuleParser.parse('@@/example/$m1,m2=v2,m3=/^r3\\$/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 31,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 11,
                value: '/example/',
            },
            modifiers: {
                type: 'ModifierList',
                start: 12,
                end: 31,
                children: [
                    {
                        type: 'Modifier',
                        start: 12,
                        end: 14,
                        name: {
                            type: 'Value',
                            start: 12,
                            end: 14,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 15,
                        end: 20,
                        name: {
                            type: 'Value',
                            start: 15,
                            end: 17,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 18,
                            end: 20,
                            value: 'v2',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 21,
                        end: 31,
                        name: {
                            type: 'Value',
                            start: 21,
                            end: 23,
                            value: 'm3',
                        },
                        value: {
                            type: 'Value',
                            start: 24,
                            end: 31,
                            value: '/^r3\\$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Escaped separator
        expect(NetworkRuleParser.parse('example.com\\$m1')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 15,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 15,
                value: 'example.com\\$m1',
            },
        });

        // Multiple separators
        expect(NetworkRuleParser.parse('example.com$m1$m2$m3$m4$m5')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 26,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 23,
                value: 'example.com$m1$m2$m3$m4',
            },
            modifiers: {
                type: 'ModifierList',
                start: 24,
                end: 26,
                children: [
                    {
                        type: 'Modifier',
                        start: 24,
                        end: 26,
                        name: {
                            type: 'Value',
                            start: 24,
                            end: 26,
                            value: 'm5',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('example.com$m1=v1$m2$m3=v3$m4$m5=v5')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 35,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 29,
                value: 'example.com$m1=v1$m2$m3=v3$m4',
            },
            modifiers: {
                type: 'ModifierList',
                start: 30,
                end: 35,
                children: [
                    {
                        type: 'Modifier',
                        start: 30,
                        end: 35,
                        name: {
                            type: 'Value',
                            start: 30,
                            end: 32,
                            value: 'm5',
                        },
                        value: {
                            type: 'Value',
                            start: 33,
                            end: 35,
                            value: 'v5',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Starts with "/"
        expect(NetworkRuleParser.parse('/ad.js$m1=v1')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 12,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 6,
                value: '/ad.js',
            },
            modifiers: {
                type: 'ModifierList',
                start: 7,
                end: 12,
                children: [
                    {
                        type: 'Modifier',
                        start: 7,
                        end: 12,
                        name: {
                            type: 'Value',
                            start: 7,
                            end: 9,
                            value: 'm1',
                        },
                        value: {
                            type: 'Value',
                            start: 10,
                            end: 12,
                            value: 'v1',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Pattern starts with / like regex patterns
        expect(NetworkRuleParser.parse('/ad.js^$m1=v1')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 13,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 7,
                value: '/ad.js^',
            },
            modifiers: {
                type: 'ModifierList',
                start: 8,
                end: 13,
                children: [
                    {
                        type: 'Modifier',
                        start: 8,
                        end: 13,
                        name: {
                            type: 'Value',
                            start: 8,
                            end: 10,
                            value: 'm1',
                        },
                        value: {
                            type: 'Value',
                            start: 11,
                            end: 13,
                            value: 'v1',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('/ad.js^$m1=/^v1$/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 17,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 7,
                value: '/ad.js^',
            },
            modifiers: {
                type: 'ModifierList',
                start: 8,
                end: 17,
                children: [
                    {
                        type: 'Modifier',
                        start: 8,
                        end: 17,
                        name: {
                            type: 'Value',
                            start: 8,
                            end: 10,
                            value: 'm1',
                        },
                        value: {
                            type: 'Value',
                            start: 11,
                            end: 17,
                            value: '/^v1$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Pattern contains an odd number of "/" characters
        expect(NetworkRuleParser.parse('example.com/a/b/c$m1=v1')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 23,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 17,
                value: 'example.com/a/b/c',
            },
            modifiers: {
                type: 'ModifierList',
                start: 18,
                end: 23,
                children: [
                    {
                        type: 'Modifier',
                        start: 18,
                        end: 23,
                        name: {
                            type: 'Value',
                            start: 18,
                            end: 20,
                            value: 'm1',
                        },
                        value: {
                            type: 'Value',
                            start: 21,
                            end: 23,
                            value: 'v1',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('example.com$m1,m2=/^regex$/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 27,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 11,
                value: 'example.com',
            },
            modifiers: {
                type: 'ModifierList',
                start: 12,
                end: 27,
                children: [
                    {
                        type: 'Modifier',
                        start: 12,
                        end: 14,
                        name: {
                            type: 'Value',
                            start: 12,
                            end: 14,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 15,
                        end: 27,
                        name: {
                            type: 'Value',
                            start: 15,
                            end: 17,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 18,
                            end: 27,
                            value: '/^regex$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // https://github.com/AdguardTeam/AGLint/issues/60
        expect(NetworkRuleParser.parse('||example.com/$aa/bb^$m1,m2=/^regex$/')).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 37,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                start: 0,
                end: 21,
                value: '||example.com/$aa/bb^',
            },
            modifiers: {
                type: 'ModifierList',
                start: 22,
                end: 37,
                children: [
                    {
                        type: 'Modifier',
                        start: 22,
                        end: 24,
                        name: {
                            type: 'Value',
                            start: 22,
                            end: 24,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 25,
                        end: 37,
                        name: {
                            type: 'Value',
                            start: 25,
                            end: 27,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 28,
                            end: 37,
                            value: '/^regex$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Complicated case
        expect(
            NetworkRuleParser.parse('@@/example/scripts/ad.js$m1,m2=v2,m3=/^r3\\$/,m4=/r4\\/r4$/,m5=/^r5\\$/'),
        ).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 68,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 24,
                value: '/example/scripts/ad.js',
            },
            modifiers: {
                type: 'ModifierList',
                start: 25,
                end: 68,
                children: [
                    {
                        type: 'Modifier',
                        start: 25,
                        end: 27,
                        name: {
                            type: 'Value',
                            start: 25,
                            end: 27,
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 28,
                        end: 33,
                        name: {
                            type: 'Value',
                            start: 28,
                            end: 30,
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            start: 31,
                            end: 33,
                            value: 'v2',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 34,
                        end: 44,
                        name: {
                            type: 'Value',
                            start: 34,
                            end: 36,
                            value: 'm3',
                        },
                        value: {
                            type: 'Value',
                            start: 37,
                            end: 44,
                            value: '/^r3\\$/',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 45,
                        end: 57,
                        name: {
                            type: 'Value',
                            start: 45,
                            end: 47,
                            value: 'm4',
                        },
                        value: {
                            type: 'Value',
                            start: 48,
                            end: 57,
                            value: '/r4\\/r4$/',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        start: 58,
                        end: 68,
                        name: {
                            type: 'Value',
                            start: 58,
                            end: 60,
                            value: 'm5',
                        },
                        value: {
                            type: 'Value',
                            start: 61,
                            end: 68,
                            value: '/^r5\\$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(
            NetworkRuleParser.parse('@@||example.org^$replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/v\\$1<\\/VAST>/i'),
        ).toMatchObject<NetworkRule>({
            type: NetworkRuleType.NetworkRule,
            start: 0,
            end: 72,
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                start: 2,
                end: 16,
                value: '||example.org^',
            },
            modifiers: {
                type: 'ModifierList',
                start: 17,
                end: 72,
                children: [
                    {
                        type: 'Modifier',
                        start: 17,
                        end: 72,
                        name: {
                            type: 'Value',
                            start: 17,
                            end: 24,
                            value: 'replace',
                        },
                        value: {
                            type: 'Value',
                            start: 25,
                            end: 72,
                            value: '/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/v\\$1<\\/VAST>/i',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(
            NetworkRuleParser.parse('@@||example.org^$removeheader=request:header-name'),
        ).toMatchObject<NetworkRule>(
            {
                type: NetworkRuleType.NetworkRule,
                start: 0,
                end: 49,
                category: RuleCategory.Network,
                syntax: AdblockSyntax.Common,
                exception: true,
                pattern: {
                    type: 'Value',
                    start: 2,
                    end: 16,
                    value: '||example.org^',
                },
                modifiers: {
                    type: 'ModifierList',
                    start: 17,
                    end: 49,
                    children: [
                        {
                            type: 'Modifier',
                            start: 17,
                            end: 49,
                            name: {
                                type: 'Value',
                                start: 17,
                                end: 29,
                                value: 'removeheader',
                            },
                            value: {
                                type: 'Value',
                                start: 30,
                                end: 49,
                                value: 'request:header-name',
                            },
                            exception: false,
                        },
                    ],
                },
            },
        );

        // Invalid rules
        expect(() => NetworkRuleParser.parse('')).toThrowError(
            'Network rule must have a pattern or modifiers',
        );
    });

    describe('empty modifiers should throw errors', () => {
        test.each([
            '||example.com$',
            '||example.com$ ',
            '||example.com^$  ',
        ])('should throw error for empty modifiers in "%s"', (input) => {
            expect(() => NetworkRuleParser.parse(input)).toThrowError(
                'Empty modifiers are not allowed',
            );
        });
    });

    describe('parser options should work as expected', () => {
        // TODO: Add template for test.each
        test.each([
            {
                actual: '@@||example.com$m1,m2=v2',
                expected: {
                    type: NetworkRuleType.NetworkRule,
                    category: RuleCategory.Network,
                    syntax: AdblockSyntax.Common,
                    raws: {
                        text: '@@||example.com$m1,m2=v2',
                    },
                    exception: true,
                    pattern: {
                        type: 'Value',
                        value: '||example.com',
                    },
                    modifiers: {
                        type: 'ModifierList',
                        children: [
                            {
                                type: 'Modifier',
                                name: {
                                    type: 'Value',
                                    value: 'm1',
                                },
                                exception: false,
                            },
                            {
                                type: 'Modifier',
                                name: {
                                    type: 'Value',
                                    value: 'm2',
                                },
                                value: {
                                    type: 'Value',
                                    value: 'v2',
                                },
                                exception: false,
                            },
                        ],
                    },
                },
            },
        ])('isLocIncluded should work for $actual', ({ actual, expected }) => {
            expect(
                NetworkRuleParser.parse(actual, { ...defaultParserOptions, isLocIncluded: false }),
            ).toEqual(expected);
        });
    });

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = NetworkRuleParser.parse(raw);

            if (ast) {
                return NetworkRuleGenerator.generate(ast);
            }

            return null;
        };

        // TODO: Refactor to test.each
        expect(parseAndGenerate('-ad-350-')).toEqual('-ad-350-');
        expect(parseAndGenerate('||example.com')).toEqual('||example.com');
        expect(parseAndGenerate('@@||example.com')).toEqual('@@||example.com');
        expect(parseAndGenerate('||example.com$third-party')).toEqual('||example.com$third-party');
        expect(parseAndGenerate('/regex-pattern/')).toEqual('/regex-pattern/');
        expect(parseAndGenerate('/regex-pattern/$script')).toEqual('/regex-pattern/$script');
        expect(parseAndGenerate('@@/regex-pattern/$script')).toEqual('@@/regex-pattern/$script');

        expect(parseAndGenerate('@@/example/scripts/ad.js$m1,m2=v2,m3=/^r3\\$/,m4=/r4\\/r4$/,m5=/^r5\\$/')).toEqual(
            '@@/example/scripts/ad.js$m1,m2=v2,m3=/^r3\\$/,m4=/r4\\/r4$/,m5=/^r5\\$/',
        );

        // ADG removeheader
        expect(parseAndGenerate('||example.org^$removeheader=header-name')).toEqual(
            '||example.org^$removeheader=header-name',
        );

        expect(parseAndGenerate('@@||example.org^$removeheader=header-name')).toEqual(
            '@@||example.org^$removeheader=header-name',
        );
    });

    describe('serialize & deserialize', () => {
        test.each([
            'example.com',
            '$script,redirect-rule=noopjs,domain=aternos.org',
            '@@||example.com',
            '@@||example.com^$script,third-party',
            '/ads.js^$script',
            '@@||example.org^$replace=/(<VAST[\\s\\S]*?>)[\\s\\S]*<\\/VAST>/v\\$1<\\/VAST>/i',
            '||example.com^', // without modificators
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(
                NetworkRuleParser,
                NetworkRuleGenerator,
                NetworkRuleSerializer,
                NetworkRuleDeserializer,
            );
        });
    });
});
