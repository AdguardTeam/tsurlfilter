import { CSP_HEADER_NAME } from '../../../src/modifiers/csp-modifier';
import { PERMISSIONS_POLICY_HEADER_NAME } from '../../../src/modifiers/permissions-modifier';
import { ResourceType } from '../../../src/rules/declarative-converter/declarative-rule';
import {
    TooComplexRegexpError,
    UnsupportedModifierError,
} from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { FilterScanner } from '../../../src/rules/declarative-converter/filter-scanner';
import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';
import type { ScannedFilter } from '../../../src/rules/declarative-converter/network-rules-scanner';
import { NetworkRule, NetworkRuleOption } from '../../../src/rules/network-rule';

const createFilter = async (
    filterId: number,
    lines: string[],
): Promise<ScannedFilter> => {
    const scanner = await FilterScanner.createNew({
        getId: () => filterId,
        getContent: async () => lines,
        getRuleByIndex: async (index) => lines[index],
    });

    const { rules } = scanner.getIndexedRules();

    const badFilterRules = rules.filter(({ rule }) => {
        return rule instanceof NetworkRule && rule.isOptionEnabled(NetworkRuleOption.Badfilter);
    });

    return {
        id: filterId,
        rules,
        badFilterRules,
    };
};

const allResourcesTypes = Object.values(ResourceType);

describe('DeclarativeRuleConverter', () => {
    it('converts simple blocking rules', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filter = await createFilter(
            filterId,
            ['||example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual({
            id: ruleId,
            priority: 1,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts simple allowlist rules', async () => {
        const filterId = 0;
        const filter = await createFilter(
            filterId,
            ['@@||example.org^'],
        );
        const ruleId = 1;
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual({
            id: ruleId,
            priority: 100001,
            action: {
                type: 'allow',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts important allowlist rules', async () => {
        const filterId = 0;
        const filter = await createFilter(
            filterId,
            ['@@||example.org^$important'],
        );
        const ruleId = 1;
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual({
            id: ruleId,
            priority: 1100001,
            action: {
                type: 'allow',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts rules with $third-party modifiers', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filterWithThirdPartyRules = await createFilter(
            filterId,
            ['||example.org^$third-party'],
        );
        const {
            declarativeRules: [thirdPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithThirdPartyRules],
        );
        expect(thirdPartyDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'thirdParty',
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });

        const filterWithNegateFirstPartyRules = await createFilter(
            filterId,
            ['||example.org^$~third-party'],
        );
        const {
            declarativeRules: [negateFirstPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithNegateFirstPartyRules],
        );

        expect(negateFirstPartyDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts rules with first-party modifiers', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filterWithFirstPartyRules = await createFilter(
            filterId,
            ['||example.org^$first-party'],
        );
        const {
            declarativeRules: [firstPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithFirstPartyRules],
        );
        expect(firstPartyDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });

        // TODO: Uncomment after AG-25655
        // const filterWithNegateFirstPartyRules = await createFilter(
        //     filterId,
        //     ['||example.org^$~first-party'],
        // );
        // const {
        //     declarativeRules: [negateFirstPartyDeclarative],
        // } = DeclarativeRulesConverter.convert(
        //     [filterWithNegateFirstPartyRules],
        // );
        // expect(negateFirstPartyDeclarative).toEqual({
        //     id: ruleId,
        //     priority: 2,
        //     action: {
        //         type: 'block',
        //     },
        //     condition: {
        //         domainType: 'thirdParty',
        //         urlFilter: '||example.org^',
        //         isUrlFilterCaseSensitive: false,
        //     },
        // });
    });

    it('converts rules with $domain modifiers', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filterWithDomainRules = await createFilter(
            filterId,
            ['||example.org^$domain=example.com'],
        );
        const {
            declarativeRules: [domainDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithDomainRules],
        );
        expect(domainDeclarative).toEqual({
            id: ruleId,
            priority: 201,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                initiatorDomains: ['example.com'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const filterWithMultipleDomainRules = await createFilter(
            filterId,
            ['||example.org^$domain=example.com|example2.com|~example3.com|~example4.com'],
        );
        const {
            declarativeRules: [multipleDomainDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithMultipleDomainRules],
        );
        expect(multipleDomainDeclarative).toEqual({
            id: ruleId,
            priority: 152,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                initiatorDomains: ['example.com', 'example2.com'],
                excludedInitiatorDomains: ['example3.com', 'example4.com'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const filterWithNegateDomainRules = await createFilter(
            filterId,
            ['||example.org^$domain=~example.com'],
        );
        const {
            declarativeRules: [negateDomainDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithNegateDomainRules],
        );
        expect(negateDomainDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedInitiatorDomains: ['example.com'],
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts rules with specified request types', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filterWithScriptRules = await createFilter(
            filterId,
            ['||example.org^$script'],
        );
        const {
            declarativeRules: [scriptRuleDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithScriptRules],
        );
        expect(scriptRuleDeclarative).toEqual({
            id: ruleId,
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                resourceTypes: ['script'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const filterWithNegatedScriptRules = await createFilter(
            filterId,
            ['||example.org^$~script'],
        );
        const {
            declarativeRules: [negatedScriptRuleDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithNegatedScriptRules],
        );
        expect(negatedScriptRuleDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedResourceTypes: ['script'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const filterWithMultipleRequestTypesRules = await createFilter(
            filterId,
            ['||example.org^$script,image,media'],
        );
        const {
            declarativeRules: [multipleDeclarativeRule],
        } = DeclarativeRulesConverter.convert(
            [filterWithMultipleRequestTypesRules],
        );
        expect(multipleDeclarativeRule.condition?.resourceTypes?.sort())
            .toEqual(['script', 'image', 'media'].sort());

        const filterWithMultipleNegatedRequestTypesRules = await createFilter(
            filterId,
            ['||example.org^$~script,~subdocument'],
        );
        const {
            declarativeRules: [multipleNegatedDeclarativeRule],
        } = DeclarativeRulesConverter.convert(
            [filterWithMultipleNegatedRequestTypesRules],
        );
        expect(multipleNegatedDeclarativeRule!.condition?.excludedResourceTypes?.sort())
            .toEqual(['script', 'sub_frame'].sort());
    });

    it('set rules case sensitive if necessary', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filterWithMatchCaseRules = await createFilter(
            filterId,
            ['||example.org^$match-case'],
        );
        const {
            declarativeRules: [matchCaseDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithMatchCaseRules],
        );
        expect(matchCaseDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: true,
            },
        });

        const filterWithNegatedMatchCaseRules = await createFilter(
            filterId,
            ['||example.org^$~match-case'],
        );
        const {
            declarativeRules: [negatedMatchCaseDeclarative],
        } = DeclarativeRulesConverter.convert(
            [filterWithNegatedMatchCaseRules],
        );
        expect(negatedMatchCaseDeclarative).toEqual({
            id: ruleId,
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts wildcard blocking rules', async () => {
        const filterId = 0;
        const ruleId = 1;

        const filter = await createFilter(
            filterId,
            ['||*example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule).toEqual({
            id: ruleId,
            priority: 1,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '*example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    // backreference; negative lookahead not supported;
    // https://github.com/google/re2/wiki/Syntax
    it('converts regex backslash before 1-9', async () => {
        const filterId = 0;

        const filter = await createFilter(
            filterId,
            // eslint-disable-next-line max-len
            ['/\\.vidzi\\.tv\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/\\1\\2\\3([a-f0-9]{26})\\.js/$domain=vidzi.tv'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule).toEqual(undefined);
    });

    // TODO Find how exactly the complexity of a rule is calculated
    it('checks more complex regex than allowed', async () => {
        const filterId = 0;
        // eslint-disable-next-line max-len
        const regexpRuleText = '/www\\.oka\\.fm\\/.+\\/(yuzhnyj4.gif|cel.gif|tehnoplyus.jpg|na_chb_foto_250_250.jpg|ugzemli.gif|istorii.gif|advokat.jpg|odejda-shkola.gif|russkij-svet.jpg|dveri.gif|Festival_shlyapok_2.jpg)/';
        const filter = await createFilter(
            filterId,
            [regexpRuleText],
        );

        const {
            errors,
            declarativeRules,
        } = DeclarativeRulesConverter.convert([filter]);

        const networkRule = new NetworkRule(regexpRuleText, filterId);

        const err = new TooComplexRegexpError(
            `More complex regex than allowed: "${networkRule.getText()}"`,
            networkRule,
            // Note that the declarative rule will be "undefined" due to
            // a conversion error, but this will not prevent error checking
            declarativeRules[0],
        );

        expect(declarativeRules).toHaveLength(0);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toStrictEqual(err);
    });

    it('converts regex negative lookahead', async () => {
        const filterId = 0;

        const filter = await createFilter(
            filterId,
            ['/rustorka.\\w+\\/forum\\/(?!login.php)/$removeheader=location'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual(undefined);
    });

    // Cookies rules are not supported
    it('converts $cookies rules', async () => {
        const filterId = 0;

        const filter = await createFilter(
            filterId,
            ['$cookie=bf_lead'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule).toEqual(undefined);
    });

    describe('converts cyrillic domain rules', () => {
        it('converts domains section', async () => {
            const filterId = 0;
            const ruleId = 1;
            const filter = await createFilter(
                filterId,
                ['path$domain=меил.рф'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toEqual({
                id: ruleId,
                priority: 201,
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: 'path',
                    isUrlFilterCaseSensitive: false,
                    initiatorDomains: [
                        'xn--e1agjb.xn--p1ai',
                    ],
                },
            });
        });

        it('converts urlFilterSection', async () => {
            const filterId = 0;
            const ruleId = 1;
            const filter = await createFilter(
                filterId,
                ['||банрек.рус^$third-party'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toEqual({
                id: ruleId,
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: 'xn--||-8kcdv4aty.xn--^-4tbdh',
                    domainType: 'thirdParty',
                    isUrlFilterCaseSensitive: false,
                },
            });
        });
    });

    it('converts $redirect rules', async () => {
        const resourcesPath = '/war/redirects';
        const filterId = 0;
        const ruleId = 1;

        const filter = await createFilter(
            filterId,
            ['||example.org/script.js$script,redirect=noopjs'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [filter],
            { resourcesPath },
        );

        expect(declarativeRule).toStrictEqual({
            id: ruleId,
            priority: 1101,
            action: {
                type: 'redirect',
                redirect: {
                    extensionPath: `${resourcesPath}/noopjs.js`,
                },
            },
            condition: {
                isUrlFilterCaseSensitive: false,
                resourceTypes: [
                    'script',
                ],
                urlFilter: '||example.org/script.js',
            },
        });
    });

    describe('converts $denyallow rules', () => {
        it('converts denyallow simple rule', async () => {
            const filterId = 0;
            const ruleId = 1;

            const filter = await createFilter(
                filterId,
                ['/adguard_circle.png$image,denyallow=cdn.adguard.com,domain=testcases.adguard.com|surge.sh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toStrictEqual({
                id: ruleId,
                priority: 252,
                action: { type: 'block' },
                condition: {
                    urlFilter: '/adguard_circle.png',
                    initiatorDomains: [
                        'testcases.adguard.com',
                        'surge.sh',
                    ],
                    excludedRequestDomains: ['cdn.adguard.com'],
                    resourceTypes: ['image'],
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('converts denyallow exclude rule', async () => {
            const filterId = 0;
            const ruleId = 1;

            const filter = await createFilter(
                filterId,
                // eslint-disable-next-line max-len
                ['@@/adguard_dns_map.png$image,denyallow=cdn.adguard.com|fastcdn.adguard.com,domain=testcases.adguard.com|surge.sh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toStrictEqual({
                id: ruleId,
                priority: 100252,
                action: { type: 'allow' },
                condition: {
                    urlFilter: '/adguard_dns_map.png',
                    initiatorDomains: [
                        'testcases.adguard.com',
                        'surge.sh',
                    ],
                    excludedRequestDomains: [
                        'cdn.adguard.com',
                        'fastcdn.adguard.com',
                    ],
                    resourceTypes: ['image'],
                    isUrlFilterCaseSensitive: false,
                },
            });
        });
    });

    describe('check $removeparam', () => {
        it('converts $removeparam rules', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||example.com$removeparam=param'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toEqual({
                id: ruleId,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['param'],
                            },
                        },
                    },
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                },
            });
        });

        it('converts empty $removeparam rule', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||example.com$removeparam'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toEqual({
                id: ruleId,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            query: '',
                        },
                    },
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                },
            });
        });

        it('combine several $removeparam rule', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    '||testcases.adguard.com$xmlhttprequest,removeparam=p1case1',
                    '||testcases.adguard.com$xmlhttprequest,removeparam=p2case1',
                    '||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1',
                    '$xmlhttprequest,removeparam=p1case2',
                ],
            );
            const firstGroupedRuleId = 1;
            const secondGroupedRuleId = 4;

            const { declarativeRules } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules[0]).toStrictEqual({
                id: firstGroupedRuleId,
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: [
                                    'p1case1',
                                    'p2case1',
                                    'P3Case1',
                                ],
                            },
                        },
                    },
                },
                condition: {
                    urlFilter: '||testcases.adguard.com',
                    resourceTypes: ['xmlhttprequest'],
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: secondGroupedRuleId,
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['p1case2'],
                            },
                        },
                    },
                },
                condition: {
                    resourceTypes: ['xmlhttprequest'],
                    isUrlFilterCaseSensitive: false,
                },
            });
        });

        it('converts $removeparam resource type xmlhttprequest', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||testcases.adguard.com$xmlhttprequest,removeparam=p2case2'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toEqual({
                id: ruleId,
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['p2case2'],
                            },
                        },
                    },
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: ['xmlhttprequest'],
                    urlFilter: '||testcases.adguard.com',
                },
            });
        });
    });

    it('ignores rules with single one modifier enabled - popup', async () => {
        const filterId = 0;

        const filter = await createFilter(
            filterId,
            ['||example.org^$popup', '||test.com^$document,popup'],
        );
        const { declarativeRules } = DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRules).toHaveLength(1);
        expect(declarativeRules[0]).toStrictEqual({
            id: 2,
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||test.com^',
                resourceTypes: ['main_frame'],
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('converts all rule', async () => {
        const filterId = 0;

        const filter = await createFilter(
            filterId,
            ['||example.org^$all', '||test.com^$document'],
        );
        const { declarativeRules } = DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRules).toHaveLength(2);
        expect(declarativeRules[0]).toStrictEqual({
            id: 1,
            priority: 55,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
                resourceTypes: allResourcesTypes,
            },
        });
        expect(declarativeRules[1]).toStrictEqual({
            id: 2,
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||test.com^',
                resourceTypes: ['main_frame'],
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    it('ignore exceptions rules with non-blocking modifiers', async () => {
        const filterId = 0;

        const filter = await createFilter(
            filterId,
            [
                '||example.com/script.js$script,redirect=noopjs',
                '||example.com^$image',
                '@@||example.com^$redirect',
            ],
        );
        const { declarativeRules } = DeclarativeRulesConverter.convert(
            [filter],
            { resourcesPath: '/path/to/resources' },
        );
        expect(declarativeRules).toHaveLength(2);
        expect(declarativeRules[0]).toStrictEqual({
            id: 1,
            priority: 1101,
            action: {
                type: 'redirect',
                redirect: {
                    extensionPath: '/path/to/resources/noopjs.js',
                },
            },
            condition: {
                urlFilter: '||example.com/script.js',
                resourceTypes: [
                    'script',
                ],
                isUrlFilterCaseSensitive: false,
            },
        });
        expect(declarativeRules[1]).toStrictEqual({
            id: 2,
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.com^',
                resourceTypes: ['image'],
                isUrlFilterCaseSensitive: false,
            },
        });
    });

    describe('check removeheader', () => {
        it('converts $removeheader rules for responseHeaders', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||example.com$removeheader=refresh'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toStrictEqual({
                id: ruleId,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'refresh', operation: 'remove' },
                    ],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts $removeheader rules for requestHeaders', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||example.com$removeheader=request:location'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toStrictEqual({
                id: ruleId,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'location', operation: 'remove' },
                    ],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts removeheader rules for both: response and request', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    '||example.com$removeheader=location',
                    '||example.com$removeheader=request:location',
                ],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toStrictEqual({
                id: ruleId,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{ header: 'location', operation: 'remove' }],
                    requestHeaders: [{ header: 'location', operation: 'remove' }],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('returns errors on unsupported headers in removeheader rules', async () => {
            const ruleWithUnsupportedHeaders = [
                '||example.com$removeheader=origin',
                '||example.com$removeheader=content-type',
            ];
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    ruleWithUnsupportedHeaders[0],
                    '||example.com$removeheader=location',
                    ruleWithUnsupportedHeaders[1],
                ],
            );

            const {
                declarativeRules,
                errors,
            } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 2,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'location', operation: 'remove' },
                    ],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });

            const networkRules = [
                new NetworkRule(ruleWithUnsupportedHeaders[0], filterId),
                new NetworkRule(ruleWithUnsupportedHeaders[1], filterId),
            ];
            const expectedErrors = [
                new UnsupportedModifierError(
                    // eslint-disable-next-line max-len
                    `Network rule with $removeheader modifier contains some of the unsupported headers: "${networkRules[0].getText()}"`,
                    networkRules[0],
                ),
                new UnsupportedModifierError(
                    // eslint-disable-next-line max-len
                    `Network rule with $removeheader modifier contains some of the unsupported headers: "${networkRules[1].getText()}"`,
                    networkRules[1],
                ),
            ];

            expect(errors).toHaveLength(2);
            expect(errors[0]).toStrictEqual(expectedErrors[0]);
            expect(errors[1]).toStrictEqual(expectedErrors[1]);
        });

        it('converts removeheader rules for responseHeaders and skips general allowlist rule', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    '||example.org$removeheader=refresh',
                    '||example.org$removeheader=location',
                    '@@||example.org/path/$removeheader',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'refresh', operation: 'remove' },
                        { header: 'location', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.org',
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        // eslint-disable-next-line max-len
        it('converts $removeheader rules for responseHeaders and skips general allowlist rule and for other domain', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    '||example.org^$removeheader=refresh',
                    '||example.org^$removeheader=location',
                    '||example.com^$removeheader=refresh',
                    '@@||example.org^$removeheader',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'refresh', operation: 'remove' },
                        { header: 'location', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.org^',
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: allResourcesTypes,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 3,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'refresh', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('skips convert bad values', async () => {
            const filterId = 0;
            const badRule = '||example.com$removeheader=dnt:1';
            const filter = await createFilter(0, [badRule]);

            const {
                declarativeRules,
                errors,
            } = DeclarativeRulesConverter.convert([filter]);

            const networkRule = new NetworkRule(badRule, filterId);
            const err = new UnsupportedModifierError(
                // eslint-disable-next-line max-len
                `Network rule with $removeheader modifier contains some of the unsupported headers: "${networkRule.getText()}"`,
                networkRule,
            );

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toStrictEqual(err);
        });

        it('combine several $removeheader rule', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    '||example.com$removeheader=header1',
                    '||example.com$removeheader=request:header2',
                    '||example.com$removeheader=header3',
                    '||example.com$removeheader=request:header4',
                ],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'header1', operation: 'remove' },
                        { header: 'header3', operation: 'remove' },
                    ],
                    requestHeaders: [
                        { header: 'header2', operation: 'remove' },
                        { header: 'header4', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com',
                    isUrlFilterCaseSensitive: false,
                    resourceTypes: allResourcesTypes,
                },
            });
        });
    });

    describe('check $csp', () => {
        it('converts $csp rules', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||example.com$csp=frame-src \'none\''],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: 'append',
                        value: 'frame-src \'none\'',
                    }],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('combine several $csp rule', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                [
                    '||example.com$csp=frame-src \'none\'',
                    '||example.com$csp=script-src \'self\' \'unsafe-eval\' http: https:',
                    '||example.com$csp=worker-src \'none\',subdocument',
                    '$csp=worker-src \'none\',domain=example.org|example.net',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(3);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: 'append',
                        value: 'frame-src \'none\'; script-src \'self\' \'unsafe-eval\' http: https:',
                    }],
                },
                condition: {
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: 3,
                priority: 101,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: 'append',
                        value: 'worker-src \'none\'',
                    }],
                },
                condition: {
                    urlFilter: '||example.com',
                    resourceTypes: ['sub_frame'],
                    isUrlFilterCaseSensitive: false,
                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: 4,
                priority: 151,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: CSP_HEADER_NAME,
                        operation: 'append',
                        value: 'worker-src \'none\'',
                    }],
                },
                condition: {
                    initiatorDomains: [
                        'example.org',
                        'example.net',
                    ],
                    resourceTypes: allResourcesTypes,
                    isUrlFilterCaseSensitive: false,
                },
            });
        });
    });

    describe('skips convert cosmetic exclusions modifiers without errors', () => {
        const cosmeticExclusionsModifiers = ['elemhide', 'specifichide', 'generichide'];

        it.each(cosmeticExclusionsModifiers)('skips %s', async (modifier) => {
            const badRule = `@@||example.com$${modifier}`;
            const filter = await createFilter(0, [badRule]);

            const {
                declarativeRules,
                errors,
            } = DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(0);
        });
    });

    describe('check $cookie', () => {
        it('converts $cookie rules without params', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.com$cookie'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [[filterId, rules]],
            );
            expect(declarativeRules.length).toBe(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [{
                        header: 'Cookie',
                        operation: 'remove',
                    }],
                    responseHeaders: [{
                        header: 'Set-Cookie',
                        operation: 'remove',
                    }],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('decline conversion $cookie rules with parameters', () => {
            const filterId = 0;
            const rulesText = [
                '||example.com$cookie=lang',
                '||example.com$cookie=user;maxAge=3600',
                '||example.com$cookie=utm;maxAge=3600;sameSite=lax',
            ];
            const rules = createRulesFromText(
                filterId,
                rulesText,
            );

            const {
                declarativeRules,
                errors,
            } = DeclarativeRulesConverter.convert(
                [[filterId, rules]],
            );
            expect(errors.length).toBe(3);

            const networkRules = [
                new NetworkRule(rulesText[0], filterId),
                new NetworkRule(rulesText[1], filterId),
                new NetworkRule(rulesText[2], filterId),
            ];

            const expectedErrors = [
                new UnsupportedModifierError(
                    // eslint-disable-next-line max-len
                    `The use of additional parameters in $cookie (apart from $cookie itself) is not supported: "${networkRules[0].getText()}"`,
                    networkRules[0],
                ),
                new UnsupportedModifierError(
                    // eslint-disable-next-line max-len
                    `The use of additional parameters in $cookie (apart from $cookie itself) is not supported: "${networkRules[1].getText()}"`,
                    networkRules[1],
                ),
                new UnsupportedModifierError(
                    // eslint-disable-next-line max-len
                    `The use of additional parameters in $cookie (apart from $cookie itself) is not supported: "${networkRules[2].getText()}"`,
                    networkRules[2],
                ),
            ];

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(3);
            expect(errors[0]).toStrictEqual(expectedErrors[0]);
            expect(errors[1]).toStrictEqual(expectedErrors[1]);
            expect(errors[2]).toStrictEqual(expectedErrors[2]);
        });
    });

    describe('check $to', () => {
        it('converts $to rule with two domains', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['/ads$to=evil.com|evil.org'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    requestDomains: [
                        'evil.com',
                        'evil.org',
                    ],
                    urlFilter: '/ads',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts $to rule with one included and one excluded domain', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['/ads$to=~not.evil.com|evil.com'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    requestDomains: ['evil.com'],
                    excludedRequestDomains: ['not.evil.com'],
                    urlFilter: '/ads',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts $to rule with two excluded domains', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['/ads$to=~good.com|~good.org'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    excludedRequestDomains: [
                        'good.com',
                        'good.org',
                    ],
                    urlFilter: '/ads',
                    resourceTypes: allResourcesTypes,
                },
            });
        });
    });

    describe('check $method', () => {
        it('converts rule with two permitted methods', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||evil.com$method=get|head'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 76,
                action: {
                    type: 'block',
                },
                condition: {
                    requestMethods: ['get', 'head'],
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts rule with two restricted methods', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['||evil.com$method=~post|~put'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    excludedRequestMethods: ['post', 'put'],
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('allowlist rule with one permitted method', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['@@||evil.com$method=get'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 100101,
                action: {
                    type: 'allow',
                },
                condition: {
                    requestMethods: ['get'],
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('allowlist rule with two restricted methods', async () => {
            const filterId = 0;
            const filter = await createFilter(
                filterId,
                ['@@||evil.com$method=~post'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 100002,
                action: {
                    type: 'allow',
                },
                condition: {
                    excludedRequestMethods: ['post'],
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('returns UnsupportedModifierError for `trace` method', async () => {
            const filterId = 0;
            const ruleText = '||evil.com$method=trace';
            const filter = await createFilter(filterId, [ruleText]);

            const {
                declarativeRules,
                errors,
            } = DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);

            const networkRule = new NetworkRule(ruleText, filterId);

            const err = new UnsupportedModifierError(
                // eslint-disable-next-line max-len
                `Network rule with $method modifier containing 'trace' method is not supported: "${networkRule.getText()}"`,
                networkRule,
            );
            expect(errors[0]).toStrictEqual(err);
        });
    });

    describe('check $permissions', () => {
        it('converts $permissions rule', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.org^$permissions=autoplay=()'],
            );

            const {
                declarativeRules,
            } = DeclarativeRulesConverter.convert(
                [[filterId, rules]],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: PERMISSIONS_POLICY_HEADER_NAME,
                        operation: 'append',
                        value: 'autoplay=()',
                    }],
                },
                condition: {
                    isUrlFilterCaseSensitive: false,
                    urlFilter: '||example.org^',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts several $permissions directives', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                [
                    '$domain=example.org|example.com,permissions=storage-access=()\\, сamera=()',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert(
                [[filterId, rules]],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: 1,
                priority: 151,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: PERMISSIONS_POLICY_HEADER_NAME,
                        operation: 'append',
                        value: 'storage-access=(), сamera=()',
                    }],
                },
                condition: {
                    initiatorDomains: [
                        'example.org',
                        'example.com',
                    ],
                    resourceTypes: allResourcesTypes,
                    isUrlFilterCaseSensitive: false,
                },
            });
        });
    });
});
