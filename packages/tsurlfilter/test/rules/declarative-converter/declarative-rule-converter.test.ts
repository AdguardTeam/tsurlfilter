import { CSP_HEADER_NAME } from '../../../src/modifiers/csp-modifier';
import { ResourceType } from '../../../src/rules/declarative-converter/declarative-rule';
import {
    TooComplexRegexpError,
    UnsupportedModifierError,
} from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';
import { NetworkRule } from '../../../src/rules/network-rule';
import { IndexedRule } from '../../../src/rules/rule';
import { RuleFactory } from '../../../src/rules/rule-factory';

const createRulesFromText = (
    filterId: number,
    lines: string[],
): IndexedRule[] => {
    let idx = 0;

    return lines
        .map((r) => {
            const rule = RuleFactory.createRule(r, filterId);
            return rule
                // eslint-disable-next-line no-plusplus
                ? new IndexedRule(rule, idx++)
                : null;
        })
        .filter((r) => r) as IndexedRule[];
};

const allResourcesTypes = Object.values(ResourceType);

describe('DeclarativeRuleConverter', () => {
    it('converts simple blocking rules', () => {
        const filterId = 0;
        const ruleId = 1;

        const rules = createRulesFromText(
            filterId,
            ['||example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );
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

    it('converts simple allowlist rules', () => {
        const filterId = 0;
        const rules = createRulesFromText(
            filterId,
            ['@@||example.org^'],
        );
        const ruleId = 1;
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );
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

    it('converts important allowlist rules', () => {
        const filterId = 0;
        const rules = createRulesFromText(
            filterId,
            ['@@||example.org^$important'],
        );
        const ruleId = 1;
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );
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

    it('converts rules with $third-party modifiers', () => {
        const filterId = 0;
        const ruleId = 1;

        const thirdPartyRules = createRulesFromText(
            filterId,
            ['||example.org^$third-party'],
        );
        const {
            declarativeRules: [thirdPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, thirdPartyRules]],
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

        const negateFirstPartyRules = createRulesFromText(
            filterId,
            ['||example.org^$~third-party'],
        );
        const {
            declarativeRules: [negateFirstPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, negateFirstPartyRules]],
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

    it('converts rules with $first-party modifiers', () => {
        const filterId = 0;
        const ruleId = 1;

        const firstPartyRules = createRulesFromText(
            filterId,
            ['||example.org^$first-party'],
        );
        const {
            declarativeRules: [firstPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, firstPartyRules]],
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

        const negateFirstPartyRules = createRulesFromText(
            filterId,
            ['||example.org^$~first-party'],
        );
        const {
            declarativeRules: [negateFirstPartyDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, negateFirstPartyRules]],
        );
        expect(negateFirstPartyDeclarative).toEqual({
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
    });

    it('converts rules with $domain modifiers', () => {
        const filterId = 0;
        const ruleId = 1;

        const domainRules = createRulesFromText(
            filterId,
            ['||example.org^$domain=example.com'],
        );
        const {
            declarativeRules: [domainDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, domainRules]],
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

        const multipleDomainRules = createRulesFromText(
            filterId,
            ['||example.org^$domain=example.com|example2.com|~example3.com|~example4.com'],
        );
        const {
            declarativeRules: [multipleDomainDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, multipleDomainRules]],
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

        const negateDomainRules = createRulesFromText(
            filterId,
            ['||example.org^$domain=~example.com'],
        );
        const {
            declarativeRules: [negateDomainDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, negateDomainRules]],
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

    it('converts rules with specified request types', () => {
        const filterId = 0;
        const ruleId = 1;

        const scriptRules = createRulesFromText(
            filterId,
            ['||example.org^$script'],
        );
        const {
            declarativeRules: [scriptRuleDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, scriptRules]],
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

        const negatedScriptRules = createRulesFromText(
            filterId,
            ['||example.org^$~script'],
        );
        const {
            declarativeRules: [negatedScriptRuleDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, negatedScriptRules]],
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

        const multipleRequestTypesRules = createRulesFromText(
            filterId,
            ['||example.org^$script,image,media'],
        );
        const {
            declarativeRules: [multipleDeclarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, multipleRequestTypesRules]],
        );
        expect(multipleDeclarativeRule.condition?.resourceTypes?.sort())
            .toEqual(['script', 'image', 'media'].sort());

        const multipleNegatedRequestTypesRules = createRulesFromText(
            filterId,
            ['||example.org^$~script,~subdocument'],
        );
        const {
            declarativeRules: [multipleNegatedDeclarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, multipleNegatedRequestTypesRules]],
        );
        expect(multipleNegatedDeclarativeRule!.condition?.excludedResourceTypes?.sort())
            .toEqual(['script', 'sub_frame'].sort());
    });

    it('set rules case sensitive if necessary', () => {
        const filterId = 0;
        const ruleId = 1;

        const matchCaseRules = createRulesFromText(
            filterId,
            ['||example.org^$match-case'],
        );
        const {
            declarativeRules: [matchCaseDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, matchCaseRules]],
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

        const negatedMatchCaseRules = createRulesFromText(
            filterId,
            ['||example.org^$~match-case'],
        );
        const {
            declarativeRules: [negatedMatchCaseDeclarative],
        } = DeclarativeRulesConverter.convert(
            [[filterId, negatedMatchCaseRules]],
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

    it('converts wildcard blocking rules', () => {
        const filterId = 0;
        const ruleId = 1;

        const rules = createRulesFromText(
            filterId,
            ['||*example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );

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
    it('converts regex backslash before 1-9', () => {
        const filterId = 0;

        const rules = createRulesFromText(
            filterId,
            // eslint-disable-next-line max-len
            ['/\\.vidzi\\.tv\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/\\1\\2\\3([a-f0-9]{26})\\.js/$domain=vidzi.tv'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );

        expect(declarativeRule).toEqual(undefined);
    });

    // TODO Find how exactly the complexity of a rule is calculated
    it('checks more complex regex than allowed', () => {
        const filterId = 0;
        // eslint-disable-next-line max-len
        const regexpRuleText = '/www\\.oka\\.fm\\/.+\\/(yuzhnyj4.gif|cel.gif|tehnoplyus.jpg|na_chb_foto_250_250.jpg|ugzemli.gif|istorii.gif|advokat.jpg|odejda-shkola.gif|russkij-svet.jpg|dveri.gif|Festival_shlyapok_2.jpg)/';
        const rules = createRulesFromText(
            filterId,
            [regexpRuleText],
        );

        const {
            errors,
            declarativeRules,
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );

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

    it('converts regex negative lookahead', () => {
        const filterId = 0;

        const rules = createRulesFromText(
            filterId,
            ['/rustorka.\\w+\\/forum\\/(?!login.php)/$removeheader=location'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );
        expect(declarativeRule).toEqual(undefined);
    });

    // Cookies rules are not supported
    it('converts $cookies rules', () => {
        const filterId = 0;

        const rules = createRulesFromText(
            filterId,
            ['$cookie=bf_lead'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );

        expect(declarativeRule).toEqual(undefined);
    });

    describe('converts cyrillic domain rules', () => {
        it('converts domains section', () => {
            const filterId = 0;
            const ruleId = 1;
            const rules = createRulesFromText(
                filterId,
                ['path$domain=меил.рф'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);

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

        it('converts urlFilterSection', () => {
            const filterId = 0;
            const ruleId = 1;
            const rules = createRulesFromText(
                filterId,
                ['||банрек.рус^$third-party'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);

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

    it('converts $redirect rules', () => {
        const resourcesPath = '/war/redirects';
        const filterId = 0;
        const ruleId = 1;

        const rules = createRulesFromText(
            filterId,
            ['||example.org/script.js$script,redirect=noopjs'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
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
        it('converts denyallow simple rule', () => {
            const filterId = 0;
            const ruleId = 1;

            const rules = createRulesFromText(
                filterId,
                ['/adguard_circle.png$image,denyallow=cdn.adguard.com,domain=testcases.adguard.com|surge.sh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);

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

        it('converts denyallow exclude rule', () => {
            const filterId = 0;
            const ruleId = 1;

            const rules = createRulesFromText(
                filterId,
                // eslint-disable-next-line max-len
                ['@@/adguard_dns_map.png$image,denyallow=cdn.adguard.com|fastcdn.adguard.com,domain=testcases.adguard.com|surge.sh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);

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
        it('converts $removeparam rules', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.com$removeparam=param'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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

        it('converts empty $removeparam rule', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.com$removeparam'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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

        it('combine several $removeparam rule', () => {
            const filterId = 0;
            const rules = createRulesFromText(
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
                [[filterId, rules]],
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

        it('converts $removeparam resource type xmlhttprequest', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||testcases.adguard.com$xmlhttprequest,removeparam=p2case2'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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

    it('ignores rules with single one modifier enabled - popup', () => {
        const filterId = 0;

        const rules = createRulesFromText(
            filterId,
            ['||example.org^$popup', '||test.com^$document,popup'],
        );
        const { declarativeRules } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );
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

    it('converts all rule', () => {
        const filterId = 0;

        const rules = createRulesFromText(
            filterId,
            ['||example.org^$all', '||test.com^$document'],
        );
        const { declarativeRules } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
        );
        expect(declarativeRules).toHaveLength(2);
        expect(declarativeRules[0]).toStrictEqual({
            id: 1,
            priority: 56,
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

    it('ignore exceptions rules with non-blocking modifiers', () => {
        const filterId = 0;

        const rules = createRulesFromText(
            filterId,
            [
                '||example.com/script.js$script,redirect=noopjs',
                '||example.com^$image',
                '@@||example.com^$redirect',
            ],
        );
        const { declarativeRules } = DeclarativeRulesConverter.convert(
            [[filterId, rules]],
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
        it('converts $removeheader rules for responseHeaders', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.com$removeheader=refresh'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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

        it('converts $removeheader rules for requestHeaders', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.com$removeheader=request:location'],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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

        it('converts removeheader rules for both: response and request', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                [
                    '||example.com$removeheader=location',
                    '||example.com$removeheader=request:location',
                ],
            );
            const ruleId = 1;

            const {
                declarativeRules: [declarativeRule],
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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
            const rules = createRulesFromText(
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
            } = await DeclarativeRulesConverter.convert([[filterId, rules]]);
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

        it('converts removeheader rules for responseHeaders and skips general allowlist rule', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                [
                    '||example.org$removeheader=refresh',
                    '||example.org$removeheader=location',
                    '@@||example.org/path/$removeheader',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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
        it('converts $removeheader rules for responseHeaders and skips general allowlist rule and for other domain', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                [
                    '||example.org^$removeheader=refresh',
                    '||example.org^$removeheader=location',
                    '||example.com^$removeheader=refresh',
                    '@@||example.org^$removeheader',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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

        it('skips convert bad values', () => {
            const filterId = 0;
            const badRule = '||example.com$removeheader=dnt:1';
            const rules = createRulesFromText(0, [badRule]);

            const {
                declarativeRules,
                errors,
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);

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

        it('combine several $removeheader rule', () => {
            const filterId = 0;
            const rules = createRulesFromText(
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
            } = DeclarativeRulesConverter.convert([[filterId, rules]]);
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
        it('converts $csp rules', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                ['||example.com$csp=frame-src \'none\''],
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

        it('combine several $csp rule', () => {
            const filterId = 0;
            const rules = createRulesFromText(
                filterId,
                [
                    '||example.com$csp=frame-src \'none\'',
                    '||example.com$csp=script-src \'self\' \'unsafe-eval\' http: https:',
                    '||example.com$csp=worker-src \'none\',subdocument',
                    '$csp=worker-src \'none\',domain=example.org|example.net',
                ],
            );

            const { declarativeRules } = DeclarativeRulesConverter.convert(
                [[filterId, rules]],
            );
            expect(declarativeRules.length).toBe(3);
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

        it.each(cosmeticExclusionsModifiers)('skips %s', (modifier) => {
            const badRule = `@@||example.com$${modifier}`;
            const rules = createRulesFromText(0, [badRule]);

            const {
                declarativeRules,
                errors,
            } = DeclarativeRulesConverter.convert([[0, rules]]);

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
});
