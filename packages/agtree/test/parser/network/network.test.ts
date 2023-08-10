import { NetworkRuleParser } from '../../../src/parser/network';
import { AdblockSyntax } from '../../../src/utils/adblockers';
import { type NetworkRule, RuleCategory } from '../../../src/parser/common';

describe('NetworkRuleParser', () => {
    test('parse', () => {
        expect(NetworkRuleParser.parse('||example.com')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 13,
                    line: 1,
                    column: 14,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 13,
                        line: 1,
                        column: 14,
                    },
                },
                value: '||example.com',
            },
        });

        expect(NetworkRuleParser.parse('@@||example.com')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
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
                value: '||example.com',
            },
        });

        expect(NetworkRuleParser.parse('@@||example.com$m1,m2=v2')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 24,
                    line: 1,
                    column: 25,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
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
                value: '||example.com',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 16,
                        line: 1,
                        column: 17,
                    },
                    end: {
                        offset: 24,
                        line: 1,
                        column: 25,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 16,
                                line: 1,
                                column: 17,
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
                                    offset: 16,
                                    line: 1,
                                    column: 17,
                                },
                                end: {
                                    offset: 18,
                                    line: 1,
                                    column: 19,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 19,
                                line: 1,
                                column: 20,
                            },
                            end: {
                                offset: 24,
                                line: 1,
                                column: 25,
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
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                            },
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                            },
                            value: 'v2',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('/example/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
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
                value: '/example/',
            },
        });

        expect(NetworkRuleParser.parse('@@/example/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                },
                value: '/example/',
            },
        });

        expect(NetworkRuleParser.parse('@@/example/$m1,m2=v2')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                },
                value: '/example/',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 12,
                        line: 1,
                        column: 13,
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
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
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
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
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
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                            },
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 18,
                                    line: 1,
                                    column: 19,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'v2',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Last $ in regex pattern
        expect(NetworkRuleParser.parse('@@/example/$m1,m2=v2,m3=/^r3$/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 30,
                    line: 1,
                    column: 31,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                },
                value: '/example/',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 12,
                        line: 1,
                        column: 13,
                    },
                    end: {
                        offset: 30,
                        line: 1,
                        column: 31,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
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
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
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
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                            },
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 18,
                                    line: 1,
                                    column: 19,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'v2',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                            end: {
                                offset: 30,
                                line: 1,
                                column: 31,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                                end: {
                                    offset: 23,
                                    line: 1,
                                    column: 24,
                                },
                            },
                            value: 'm3',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                                end: {
                                    offset: 30,
                                    line: 1,
                                    column: 31,
                                },
                            },
                            value: '/^r3$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Escaped $ in regex
        expect(NetworkRuleParser.parse('@@/example/$m1,m2=v2,m3=/^r3\\$/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 31,
                    line: 1,
                    column: 32,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 11,
                        line: 1,
                        column: 12,
                    },
                },
                value: '/example/',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 12,
                        line: 1,
                        column: 13,
                    },
                    end: {
                        offset: 31,
                        line: 1,
                        column: 32,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
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
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
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
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                            },
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 18,
                                    line: 1,
                                    column: 19,
                                },
                                end: {
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'v2',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 21,
                                line: 1,
                                column: 22,
                            },
                            end: {
                                offset: 31,
                                line: 1,
                                column: 32,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                                end: {
                                    offset: 23,
                                    line: 1,
                                    column: 24,
                                },
                            },
                            value: 'm3',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                                end: {
                                    offset: 31,
                                    line: 1,
                                    column: 32,
                                },
                            },
                            value: '/^r3\\$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Escaped separator
        expect(NetworkRuleParser.parse('example.com\\$m1')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
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
                value: 'example.com\\$m1',
            },
        });

        // Multiple separators
        expect(NetworkRuleParser.parse('example.com$m1$m2$m3$m4$m5')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
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
                value: 'example.com$m1$m2$m3$m4',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 24,
                        line: 1,
                        column: 25,
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
                                offset: 24,
                                line: 1,
                                column: 25,
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
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                                end: {
                                    offset: 26,
                                    line: 1,
                                    column: 27,
                                },
                            },
                            value: 'm5',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('example.com$m1=v1$m2$m3=v3$m4$m5=v5')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 29,
                        line: 1,
                        column: 30,
                    },
                },
                value: 'example.com$m1=v1$m2$m3=v3$m4',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 30,
                        line: 1,
                        column: 31,
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
                                offset: 30,
                                line: 1,
                                column: 31,
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
                                    offset: 30,
                                    line: 1,
                                    column: 31,
                                },
                                end: {
                                    offset: 32,
                                    line: 1,
                                    column: 33,
                                },
                            },
                            value: 'm5',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                                end: {
                                    offset: 35,
                                    line: 1,
                                    column: 36,
                                },
                            },
                            value: 'v5',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Starts with "/"
        expect(NetworkRuleParser.parse('/ad.js$m1=v1')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 6,
                        line: 1,
                        column: 7,
                    },
                },
                value: '/ad.js',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                    end: {
                        offset: 12,
                        line: 1,
                        column: 13,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 7,
                                line: 1,
                                column: 8,
                            },
                            end: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 7,
                                    line: 1,
                                    column: 8,
                                },
                                end: {
                                    offset: 9,
                                    line: 1,
                                    column: 10,
                                },
                            },
                            value: 'm1',
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
                                    offset: 12,
                                    line: 1,
                                    column: 13,
                                },
                            },
                            value: 'v1',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Pattern starts with / like regex patterns
        expect(NetworkRuleParser.parse('/ad.js^$m1=v1')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 13,
                    line: 1,
                    column: 14,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                },
                value: '/ad.js^',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 8,
                        line: 1,
                        column: 9,
                    },
                    end: {
                        offset: 13,
                        line: 1,
                        column: 14,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 8,
                                line: 1,
                                column: 9,
                            },
                            end: {
                                offset: 13,
                                line: 1,
                                column: 14,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 8,
                                    line: 1,
                                    column: 9,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'm1',
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
                                    offset: 13,
                                    line: 1,
                                    column: 14,
                                },
                            },
                            value: 'v1',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('/ad.js^$m1=/^v1$/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 0,
                        line: 1,
                        column: 1,
                    },
                    end: {
                        offset: 7,
                        line: 1,
                        column: 8,
                    },
                },
                value: '/ad.js^',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 8,
                        line: 1,
                        column: 9,
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
                                offset: 8,
                                line: 1,
                                column: 9,
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
                                    offset: 8,
                                    line: 1,
                                    column: 9,
                                },
                                end: {
                                    offset: 10,
                                    line: 1,
                                    column: 11,
                                },
                            },
                            value: 'm1',
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
                            value: '/^v1$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // Pattern contains an odd number of "/" characters
        expect(NetworkRuleParser.parse('example.com/a/b/c$m1=v1')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
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
                value: 'example.com/a/b/c',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 18,
                        line: 1,
                        column: 19,
                    },
                    end: {
                        offset: 23,
                        line: 1,
                        column: 24,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 18,
                                line: 1,
                                column: 19,
                            },
                            end: {
                                offset: 23,
                                line: 1,
                                column: 24,
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
                                    offset: 20,
                                    line: 1,
                                    column: 21,
                                },
                            },
                            value: 'm1',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 21,
                                    line: 1,
                                    column: 22,
                                },
                                end: {
                                    offset: 23,
                                    line: 1,
                                    column: 24,
                                },
                            },
                            value: 'v1',
                        },
                        exception: false,
                    },
                ],
            },
        });

        expect(NetworkRuleParser.parse('example.com$m1,m2=/^regex$/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
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
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
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
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 12,
                        line: 1,
                        column: 13,
                    },
                    end: {
                        offset: 27,
                        line: 1,
                        column: 28,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 12,
                                line: 1,
                                column: 13,
                            },
                            end: {
                                offset: 14,
                                line: 1,
                                column: 15,
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
                                    offset: 14,
                                    line: 1,
                                    column: 15,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 15,
                                line: 1,
                                column: 16,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 15,
                                    line: 1,
                                    column: 16,
                                },
                                end: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                            },
                            value: 'm2',
                        },
                        value: {
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
                            value: '/^regex$/',
                        },
                        exception: false,
                    },
                ],
            },
        });

        // https://github.com/AdguardTeam/AGLint/issues/60
        expect(NetworkRuleParser.parse('||example.com/$aa/bb^$m1,m2=/^regex$/')).toMatchObject<NetworkRule>({
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 37,
                    line: 1,
                    column: 38,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: false,
            pattern: {
                type: 'Value',
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
                value: '||example.com/$aa/bb^',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 22,
                        line: 1,
                        column: 23,
                    },
                    end: {
                        offset: 37,
                        line: 1,
                        column: 38,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 22,
                                line: 1,
                                column: 23,
                            },
                            end: {
                                offset: 24,
                                line: 1,
                                column: 25,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 22,
                                    line: 1,
                                    column: 23,
                                },
                                end: {
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 25,
                                line: 1,
                                column: 26,
                            },
                            end: {
                                offset: 37,
                                line: 1,
                                column: 38,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 25,
                                    line: 1,
                                    column: 26,
                                },
                                end: {
                                    offset: 27,
                                    line: 1,
                                    column: 28,
                                },
                            },
                            value: 'm2',
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
                                    offset: 37,
                                    line: 1,
                                    column: 38,
                                },
                            },
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
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 68,
                    line: 1,
                    column: 69,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
                type: 'Value',
                loc: {
                    start: {
                        offset: 2,
                        line: 1,
                        column: 3,
                    },
                    end: {
                        offset: 24,
                        line: 1,
                        column: 25,
                    },
                },
                value: '/example/scripts/ad.js',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 25,
                        line: 1,
                        column: 26,
                    },
                    end: {
                        offset: 68,
                        line: 1,
                        column: 69,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 25,
                                line: 1,
                                column: 26,
                            },
                            end: {
                                offset: 27,
                                line: 1,
                                column: 28,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 25,
                                    line: 1,
                                    column: 26,
                                },
                                end: {
                                    offset: 27,
                                    line: 1,
                                    column: 28,
                                },
                            },
                            value: 'm1',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 28,
                                line: 1,
                                column: 29,
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
                                    offset: 28,
                                    line: 1,
                                    column: 29,
                                },
                                end: {
                                    offset: 30,
                                    line: 1,
                                    column: 31,
                                },
                            },
                            value: 'm2',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 31,
                                    line: 1,
                                    column: 32,
                                },
                                end: {
                                    offset: 33,
                                    line: 1,
                                    column: 34,
                                },
                            },
                            value: 'v2',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
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
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 34,
                                    line: 1,
                                    column: 35,
                                },
                                end: {
                                    offset: 36,
                                    line: 1,
                                    column: 37,
                                },
                            },
                            value: 'm3',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 37,
                                    line: 1,
                                    column: 38,
                                },
                                end: {
                                    offset: 44,
                                    line: 1,
                                    column: 45,
                                },
                            },
                            value: '/^r3\\$/',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 45,
                                line: 1,
                                column: 46,
                            },
                            end: {
                                offset: 57,
                                line: 1,
                                column: 58,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 45,
                                    line: 1,
                                    column: 46,
                                },
                                end: {
                                    offset: 47,
                                    line: 1,
                                    column: 48,
                                },
                            },
                            value: 'm4',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 48,
                                    line: 1,
                                    column: 49,
                                },
                                end: {
                                    offset: 57,
                                    line: 1,
                                    column: 58,
                                },
                            },
                            value: '/r4\\/r4$/',
                        },
                        exception: false,
                    },
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 58,
                                line: 1,
                                column: 59,
                            },
                            end: {
                                offset: 68,
                                line: 1,
                                column: 69,
                            },
                        },
                        modifier: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 58,
                                    line: 1,
                                    column: 59,
                                },
                                end: {
                                    offset: 60,
                                    line: 1,
                                    column: 61,
                                },
                            },
                            value: 'm5',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 61,
                                    line: 1,
                                    column: 62,
                                },
                                end: {
                                    offset: 68,
                                    line: 1,
                                    column: 69,
                                },
                            },
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
            type: 'NetworkRule',
            loc: {
                start: {
                    offset: 0,
                    line: 1,
                    column: 1,
                },
                end: {
                    offset: 72,
                    line: 1,
                    column: 73,
                },
            },
            category: RuleCategory.Network,
            syntax: AdblockSyntax.Common,
            exception: true,
            pattern: {
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
                value: '||example.org^',
            },
            modifiers: {
                type: 'ModifierList',
                loc: {
                    start: {
                        offset: 17,
                        line: 1,
                        column: 18,
                    },
                    end: {
                        offset: 72,
                        line: 1,
                        column: 73,
                    },
                },
                children: [
                    {
                        type: 'Modifier',
                        loc: {
                            start: {
                                offset: 17,
                                line: 1,
                                column: 18,
                            },
                            end: {
                                offset: 72,
                                line: 1,
                                column: 73,
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
                                    offset: 24,
                                    line: 1,
                                    column: 25,
                                },
                            },
                            value: 'replace',
                        },
                        value: {
                            type: 'Value',
                            loc: {
                                start: {
                                    offset: 25,
                                    line: 1,
                                    column: 26,
                                },
                                end: {
                                    offset: 72,
                                    line: 1,
                                    column: 73,
                                },
                            },
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
                type: 'NetworkRule',
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
                category: RuleCategory.Network,
                syntax: AdblockSyntax.Common,
                exception: true,
                pattern: {
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
                    value: '||example.org^',
                },
                modifiers: {
                    type: 'ModifierList',
                    loc: {
                        start: {
                            offset: 17,
                            line: 1,
                            column: 18,
                        },
                        end: {
                            offset: 49,
                            line: 1,
                            column: 50,
                        },
                    },
                    children: [
                        {
                            type: 'Modifier',
                            loc: {
                                start: {
                                    offset: 17,
                                    line: 1,
                                    column: 18,
                                },
                                end: {
                                    offset: 49,
                                    line: 1,
                                    column: 50,
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
                                        offset: 29,
                                        line: 1,
                                        column: 30,
                                    },
                                },
                                value: 'removeheader',
                            },
                            value: {
                                type: 'Value',
                                loc: {
                                    start: {
                                        offset: 30,
                                        line: 1,
                                        column: 31,
                                    },
                                    end: {
                                        offset: 49,
                                        line: 1,
                                        column: 50,
                                    },
                                },
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

    test('generate', () => {
        const parseAndGenerate = (raw: string) => {
            const ast = NetworkRuleParser.parse(raw);

            if (ast) {
                return NetworkRuleParser.generate(ast);
            }

            return null;
        };

        expect(parseAndGenerate('-ad-350-')).toEqual('-ad-350-');
        expect(parseAndGenerate('||example.com')).toEqual('||example.com');
        expect(parseAndGenerate('@@||example.com')).toEqual('@@||example.com');
        expect(parseAndGenerate('||example.com$third-party')).toEqual('||example.com$third-party');
        expect(parseAndGenerate('||example.com$')).toEqual('||example.com');
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
});
