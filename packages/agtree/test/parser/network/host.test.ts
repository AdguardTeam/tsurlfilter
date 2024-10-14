import { AdblockSyntax } from '../../../src/utils/adblockers';
import { type HostRule, NetworkRuleType, RuleCategory } from '../../../src/nodes';
import { HostRuleParser } from '../../../src/parser/network/host';

describe('HostRuleParser', () => {
    describe('parse', () => {
        describe('valid cases', () => {
            it.each<{ actual: string; expected: HostRule }>([
                // domain only
                {
                    actual: 'example.com',
                    expected: {
                        category: RuleCategory.Network,
                        type: NetworkRuleType.HostRule,
                        syntax: AdblockSyntax.Common,
                        ip: {
                            type: 'Value',
                            value: '0.0.0.0',
                        },
                        hostnames: {
                            type: 'HostnameList',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'example.com',
                                },
                            ],
                        },
                    },
                },

                // domain only with comment
                {
                    actual: 'example.com # this is a comment',
                    expected: {
                        category: RuleCategory.Network,
                        type: NetworkRuleType.HostRule,
                        syntax: AdblockSyntax.Common,
                        ip: {
                            type: 'Value',
                            value: '0.0.0.0',
                        },
                        hostnames: {
                            type: 'HostnameList',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'example.com',
                                },
                            ],
                        },
                        comment: {
                            type: 'Value',
                            value: 'this is a comment',
                        },
                    },
                },

                // ip + single domain
                {
                    actual: '127.0.0.1 example.com',
                    expected: {
                        category: RuleCategory.Network,
                        type: NetworkRuleType.HostRule,
                        syntax: AdblockSyntax.Common,
                        ip: {
                            type: 'Value',
                            value: '127.0.0.1',
                        },
                        hostnames: {
                            type: 'HostnameList',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'example.com',
                                },
                            ],
                        },
                    },
                },

                // ip + multiple domains
                {
                    actual: '127.0.0.1 example.org example.info',
                    expected: {
                        category: RuleCategory.Network,
                        type: NetworkRuleType.HostRule,
                        syntax: AdblockSyntax.Common,
                        ip: {
                            type: 'Value',
                            value: '127.0.0.1',
                        },
                        hostnames: {
                            type: 'HostnameList',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'example.org',
                                },
                                {
                                    type: 'Value',
                                    value: 'example.info',
                                },
                            ],
                        },
                    },
                },

                // ip + multiple domains with comment
                {
                    actual: '127.0.0.1 example.org example.info # this is a comment',
                    expected: {
                        category: RuleCategory.Network,
                        type: NetworkRuleType.HostRule,
                        syntax: AdblockSyntax.Common,
                        ip: {
                            type: 'Value',
                            value: '127.0.0.1',
                        },
                        hostnames: {
                            type: 'HostnameList',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'example.org',
                                },
                                {
                                    type: 'Value',
                                    value: 'example.info',
                                },
                            ],
                        },
                        comment: {
                            type: 'Value',
                            value: 'this is a comment',
                        },
                    },
                },

                // ipv6 + single domain
                {
                    actual: 'ff02::1 ip6-allnodes',
                    expected: {
                        category: RuleCategory.Network,
                        type: NetworkRuleType.HostRule,
                        syntax: AdblockSyntax.Common,
                        ip: {
                            type: 'Value',
                            value: 'ff02::1',
                        },
                        hostnames: {
                            type: 'HostnameList',
                            children: [
                                {
                                    type: 'Value',
                                    value: 'ip6-allnodes',
                                },
                            ],
                        },
                    },
                },
            ])("should parse '$actual'", ({ actual, expected }) => {
                expect(HostRuleParser.parse(actual)).toMatchObject(expected);
            });
        });

        describe('invalid cases', () => {
            it.each<{ actual: string; expected: string | RegExp }>([
                // empty rule
                {
                    actual: '',
                    expected: 'Host rule must have at least one domain name or an IP address and a domain name',
                },

                // invalid IP
                {
                    actual: '127.0.0.-1 example.com',
                    expected: /^Invalid IP address/,
                },

                // "just domain" host rule, but with invalid domain
                {
                    actual: 'example..com',
                    expected: /^Not a valid domain:/,
                },
            ])("should throw an error for '$actual'", ({ actual, expected }) => {
                expect(() => HostRuleParser.parse(actual)).toThrow(expected);
            });
        });
    });

    describe('generate', () => {
        it.each([
            {
                actual: 'example.com',
                expected: '0.0.0.0 example.com',
            },
            {
                actual: 'example.com # this is a comment',
                expected: '0.0.0.0 example.com # this is a comment',
            },
            {
                actual: '127.0.0.1 example.com',
                expected: '127.0.0.1 example.com',
            },
            {
                actual: '127.0.0.1 example.org example.info',
                expected: '127.0.0.1 example.org example.info',
            },
            {
                actual: '127.0.0.1 example.org example.info # this is a comment',
                expected: '127.0.0.1 example.org example.info # this is a comment',
            },
            {
                actual: 'ff02::1 ip6-allnodes',
                expected: 'ff02::1 ip6-allnodes',
            },
        ])("should generate '$expected' for '$actual'", ({ actual, expected }) => {
            expect(HostRuleParser.generate(HostRuleParser.parse(actual))).toBe(expected);
        });
    });

    describe('serialize & deserialize', () => {
        it.each([
            'example.com',
            'example.com # this is a comment',
            '127.0.0.1 example.com',
            '127.0.0.1 example.org example.info',
            '127.0.0.1 example.org example.info # this is a comment',
            'ff02::1 ip6-allnodes',
        ])("should serialize and deserialize '%p'", async (input) => {
            await expect(input).toBeSerializedAndDeserializedProperly(HostRuleParser);
        });
    });
});
