import {
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';

import { CSP_HEADER_NAME } from '../../../src/modifiers/csp-modifier';
import { PERMISSIONS_POLICY_HEADER_NAME } from '../../../src/modifiers/permissions-modifier';
import { ResourceType } from '../../../src/rules/declarative-converter/declarative-rule';
import { type InvalidDeclarativeRuleError } from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';
import { re2Validator } from '../../../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../../../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import { createNetworkRuleWithNode } from '../../helpers/rule-creator';

import { createScannedFilter } from './helpers';

const allResourcesTypes = Object.values(ResourceType);
const documentResourceTypes = [ResourceType.MainFrame, ResourceType.SubFrame];

describe('DeclarativeRuleConverter', () => {
    beforeAll(() => {
        re2Validator.setValidator(regexValidatorNode);
    });

    it('converts simple blocking rules', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual({
            id: expect.any(Number),
            priority: 1,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
            },
        });
    });

    it('converts simple allowlist rules', async () => {
        const filterId = 0;
        const filter = await createScannedFilter(
            filterId,
            ['@@||example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual({
            id: expect.any(Number),
            priority: 100001,
            action: {
                type: 'allow',
            },
            condition: {
                urlFilter: '||example.org^',

            },
        });
    });

    it('converts important allowlist rules', async () => {
        const filterId = 0;
        const filter = await createScannedFilter(
            filterId,
            ['@@||example.org^$important'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual({
            id: expect.any(Number),
            priority: 1100001,
            action: {
                type: 'allow',
            },
            condition: {
                urlFilter: '||example.org^',

            },
        });
    });

    it('converts rules with $third-party modifiers', async () => {
        const filterId = 0;

        const filterWithThirdPartyRules = await createScannedFilter(
            filterId,
            ['||example.org^$third-party'],
        );
        const {
            declarativeRules: [thirdPartyDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithThirdPartyRules],
        );
        expect(thirdPartyDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'thirdParty',
                urlFilter: '||example.org^',

            },
        });

        const filterWithNegateFirstPartyRules = await createScannedFilter(
            filterId,
            ['||example.org^$~third-party'],
        );
        const {
            declarativeRules: [negateFirstPartyDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithNegateFirstPartyRules],
        );

        expect(negateFirstPartyDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',

            },
        });
    });

    it('converts rules with first-party modifiers', async () => {
        const filterId = 0;

        const filterWithFirstPartyRules = await createScannedFilter(
            filterId,
            ['||example.org^$first-party'],
        );
        const {
            declarativeRules: [firstPartyDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithFirstPartyRules],
        );
        expect(firstPartyDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',

            },
        });

        // TODO: Uncomment after AG-25655
        // const filterWithNegateFirstPartyRules = await createScannedFilter(
        //     filterId,
        //     ['||example.org^$~first-party'],
        // );
        // const {
        //     declarativeRules: [negateFirstPartyDeclarative],
        // } = await DeclarativeRulesConverter.convert(
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

        const filterWithDomainRules = await createScannedFilter(
            filterId,
            ['||example.org^$domain=example.com'],
        );
        const {
            declarativeRules: [domainDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithDomainRules],
        );
        expect(domainDeclarative).toEqual({
            id: expect.any(Number),
            priority: 201,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                initiatorDomains: ['example.com'],

            },
        });

        const filterWithMultipleDomainRules = await createScannedFilter(
            filterId,
            ['||example.org^$domain=example.com|example2.com|~example3.com|~example4.com'],
        );
        const {
            declarativeRules: [multipleDomainDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithMultipleDomainRules],
        );
        expect(multipleDomainDeclarative).toEqual({
            id: expect.any(Number),
            priority: 152,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                initiatorDomains: ['example.com', 'example2.com'],
                excludedInitiatorDomains: ['example3.com', 'example4.com'],

            },
        });

        const filterWithNegateDomainRules = await createScannedFilter(
            filterId,
            ['||example.org^$domain=~example.com'],
        );
        const {
            declarativeRules: [negateDomainDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithNegateDomainRules],
        );
        expect(negateDomainDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedInitiatorDomains: ['example.com'],

            },
        });
    });

    it('converts rules with specified request types', async () => {
        const filterId = 0;

        const filterWithScriptRules = await createScannedFilter(
            filterId,
            ['||example.org^$script'],
        );
        const {
            declarativeRules: [scriptRuleDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithScriptRules],
        );
        expect(scriptRuleDeclarative).toEqual({
            id: expect.any(Number),
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                resourceTypes: ['script'],
            },
        });

        const filterWithNegatedScriptRules = await createScannedFilter(
            filterId,
            ['||example.org^$~script'],
        );
        const {
            declarativeRules: [negatedScriptRuleDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithNegatedScriptRules],
        );
        expect(negatedScriptRuleDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedResourceTypes: ['script', 'main_frame'],
            },
        });

        const filterWithMultipleRequestTypesRules = await createScannedFilter(
            filterId,
            ['||example.org^$script,image,media'],
        );
        const {
            declarativeRules: [multipleDeclarativeRule],
        } = await DeclarativeRulesConverter.convert(
            [filterWithMultipleRequestTypesRules],
        );
        expect(multipleDeclarativeRule.condition?.resourceTypes?.sort())
            .toEqual(['script', 'image', 'media'].sort());

        const filterWithMultipleNegatedRequestTypesRules = await createScannedFilter(
            filterId,
            ['||example.org^$~script,~subdocument'],
        );
        const {
            declarativeRules: [multipleNegatedDeclarativeRule],
        } = await DeclarativeRulesConverter.convert(
            [filterWithMultipleNegatedRequestTypesRules],
        );
        expect(multipleNegatedDeclarativeRule!.condition?.excludedResourceTypes?.sort())
            .toEqual(['script', 'sub_frame', 'main_frame'].sort());
    });

    it('set rules case sensitive if necessary', async () => {
        const filterId = 0;

        const filterWithMatchCaseRules = await createScannedFilter(
            filterId,
            ['||example.org^$match-case'],
        );
        const {
            declarativeRules: [matchCaseDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithMatchCaseRules],
        );
        expect(matchCaseDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: true,
            },
        });

        const filterWithNegatedMatchCaseRules = await createScannedFilter(
            filterId,
            ['||example.org^$~match-case'],
        );
        const {
            declarativeRules: [negatedMatchCaseDeclarative],
        } = await DeclarativeRulesConverter.convert(
            [filterWithNegatedMatchCaseRules],
        );
        expect(negatedMatchCaseDeclarative).toEqual({
            id: expect.any(Number),
            priority: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                // This is false by default
                //
            },
        });
    });

    it('converts wildcard blocking rules', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||*example.org^'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule).toEqual({
            id: expect.any(Number),
            priority: 1,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '*example.org^',

            },
        });
    });

    // backreference; negative lookahead not supported;
    // https://github.com/google/re2/wiki/Syntax
    it('converts regex backslash before 1-9', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            // eslint-disable-next-line max-len
            ['/\\.vidzi\\.tv\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/\\1\\2\\3([a-f0-9]{26})\\.js/$domain=vidzi.tv'],
        );
        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule).toEqual(undefined);
    });

    it.each([
        // eslint-disable-next-line max-len
        '/www\\.oka\\.fm\\/.+\\/(yuzhnyj4.gif|cel.gif|tehnoplyus.jpg|na_chb_foto_250_250.jpg|ugzemli.gif|istorii.gif|advokat.jpg|odejda-shkola.gif|russkij-svet.jpg|dveri.gif|Festival_shlyapok_2.jpg)/',
        '/^https?:\\/\\/[a-f0-9]{32}\\.[a-z]{7}\\.sbs\\b/',
    ])('checks complex regex that should fail: %s', async (regexpRuleText) => {
        const filterId = 0;
        const filter = await createScannedFilter(
            filterId,
            [regexpRuleText],
        );

        const {
            errors,
            declarativeRules,
        } = await DeclarativeRulesConverter.convert([filter]);

        const networkRule = createNetworkRuleWithNode(regexpRuleText, filterId, 4);

        expect(declarativeRules).toHaveLength(0);
        expect(errors).toHaveLength(1);

        const actualError = errors[0];
        expect(actualError.message).toStrictEqual(`Regex is unsupported: "${regexpRuleText}"`);
        expect((actualError as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(
            networkRule.getIndex(),
        );
    });

    it('excludes regex negative lookahead', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['/rustorka.\\w+\\/forum\\/(?!login.php)/$removeheader=location'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRule).toEqual(undefined);
    });

    // Cookies rules are not supported
    it('converts $cookies rules', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['$cookie=bf_lead'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule).toEqual(undefined);
    });

    describe('converts non-ascii rules', () => {
        it('converts domains section', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['path$domain=меил.рф'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toEqual({
                id: expect.any(Number),
                priority: 201,
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: 'path',

                    initiatorDomains: [
                        'xn--e1agjb.xn--p1ai',
                    ],
                },
            });
        });

        it('converts urlFilterSection', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['||банрек.рус^$third-party'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toEqual({
                id: expect.any(Number),
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: 'xn--||-8kcdv4aty.xn--^-4tbdh',
                    domainType: 'thirdParty',

                },
            });
        });

        it("converts rule with non-ascii before the at '@' sign", async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                // non-ascii characters before '@' symbol
                ['abc“@'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: 'abc@-db7a',

                },
            });
        });
    });

    it('converts $redirect rules', async () => {
        const resourcesPath = '/web-accessible-resources/redirects';
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||example.org/script.js$script,redirect=noopjs'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert(
            [filter],
            { resourcesPath },
        );

        expect(declarativeRule).toStrictEqual({
            id: expect.any(Number),
            priority: 1101,
            action: {
                type: 'redirect',
                redirect: {
                    extensionPath: `${resourcesPath}/noopjs.js`,
                },
            },
            condition: {

                resourceTypes: [
                    'script',
                ],
                urlFilter: '||example.org/script.js',
            },
        });
    });

    it('ignores rules with $redirect-rule modifier', async () => {
        const resourcesPath = '/web-accessible-resources/redirects';
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||example.org/script.js$script,redirect-rule=noopjs'],
        );

        const {
            declarativeRules,
        } = await DeclarativeRulesConverter.convert(
            [filter],
            { resourcesPath },
        );

        expect(declarativeRules).toHaveLength(0);
    });

    describe('converts $denyallow rules', () => {
        it('converts denyallow simple rule', async () => {
            const filterId = 0;

            const filter = await createScannedFilter(
                filterId,
                ['/adguard_circle.png$image,denyallow=cdn.adguard.com,domain=testcases.adguard.com|surge.sh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toStrictEqual({
                id: expect.any(Number),
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

                },
            });
        });

        it('converts denyallow exclude rule', async () => {
            const filterId = 0;

            const filter = await createScannedFilter(
                filterId,
                // eslint-disable-next-line max-len
                ['@@/adguard_dns_map.png$image,denyallow=cdn.adguard.com|fastcdn.adguard.com,domain=testcases.adguard.com|surge.sh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRule).toStrictEqual({
                id: expect.any(Number),
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

                },
            });
        });
    });

    describe('check $removeparam', () => {
        it('converts $removeparam rules', async () => {
            const filterId = 0;
            const rule = '||example.com$removeparam=param';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
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
                    urlFilter: '||example.com',
                    resourceTypes: documentResourceTypes,
                },
            });
        });

        it('converts $removeparam rule without parameters', async () => {
            const filterId = 0;
            const rule = '||example.com$removeparam';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
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
                    urlFilter: '||example.com',
                    resourceTypes: documentResourceTypes,
                },
            });
        });

        it('combine several $removeparam rule', async () => {
            const filterId = 0;
            const rules = [
                '||testcases.adguard.com$xmlhttprequest,removeparam=p1case1',
                '||testcases.adguard.com$xmlhttprequest,removeparam=p2case1',
                '||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1',
                '$xmlhttprequest,removeparam=p1case2',
            ];
            const filter = await createScannedFilter(filterId, rules);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
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
                    resourceTypes: [ResourceType.XmlHttpRequest],
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
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
                    resourceTypes: [ResourceType.XmlHttpRequest],
                },
            });
        });

        it('converts $removeparam resource type xmlhttprequest', async () => {
            const filterId = 0;
            const rule = '||testcases.adguard.com$xmlhttprequest,removeparam=p2case2';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
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
                    resourceTypes: [ResourceType.XmlHttpRequest],
                    urlFilter: '||testcases.adguard.com',
                },
            });
        });

        it('should match only specified content-type modifier', async () => {
            const filterId = 0;
            const rule = '||example.com^$removeparam=id,script';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['id'],
                            },
                        },
                    },
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: [ResourceType.Script],
                },
            });
        });

        it('converts uri encoded params', async () => {
            const filterId = 0;
            const rule = '||example.com$removeparam=%24param';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['$param'],
                            },
                        },
                    },
                },
                condition: {
                    urlFilter: '||example.com',
                    resourceTypes: documentResourceTypes,
                },
            });
        });
    });

    it('ignores rules with explicitly enabled modifier - popup', async () => {
        const rules = [
            '||example.org^$popup',
            '||test.com^$document,popup',
        ];
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            rules,
        );
        const {
            declarativeRules,
            errors,
        } = await DeclarativeRulesConverter.convert([filter]);

        expect(errors).toHaveLength(2);
        expect(errors[0].message).toEqual('Network rule with explicitly enabled $popup modifier is not supported');
        expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(4);
        expect(errors[1].message).toEqual('Network rule with explicitly enabled $popup modifier is not supported');
        expect((errors[1] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(44);
        expect(declarativeRules).toHaveLength(0);
    });

    it('converts all rule', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||example.org^$all', '||test.com^$document'],
        );
        const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
        expect(declarativeRules).toHaveLength(2);
        expect(declarativeRules[0]).toStrictEqual({
            id: expect.any(Number),
            priority: 55,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',

                resourceTypes: allResourcesTypes,
            },
        });
        expect(declarativeRules[1]).toStrictEqual({
            id: expect.any(Number),
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||test.com^',
                resourceTypes: ['main_frame'],

            },
        });
    });

    it('ignore exceptions rules with non-blocking modifiers', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            [
                '||example.com/script.js$script,redirect=noopjs',
                '||example.com^$image',
                '@@||example.com^$redirect',
            ],
        );
        const { declarativeRules } = await DeclarativeRulesConverter.convert(
            [filter],
            { resourcesPath: '/path/to/resources' },
        );
        expect(declarativeRules).toHaveLength(2);
        expect(declarativeRules[0]).toStrictEqual({
            id: expect.any(Number),
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

            },
        });
        expect(declarativeRules[1]).toStrictEqual({
            id: expect.any(Number),
            priority: 101,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.com^',
                resourceTypes: ['image'],

            },
        });
    });

    describe('check removeheader', () => {
        it('converts $removeheader rules for responseHeaders', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['||example.com$removeheader=refresh'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'refresh', operation: 'remove' },
                    ],
                },
                condition: {

                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts $removeheader rules for requestHeaders', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['||example.com$removeheader=request:location'],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'location', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts removeheader rules for both: response and request', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                [
                    '||example.com$removeheader=location',
                    '||example.com$removeheader=request:location',
                ],
            );

            const {
                declarativeRules: [declarativeRule],
            } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRule).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{ header: 'location', operation: 'remove' }],
                    requestHeaders: [{ header: 'location', operation: 'remove' }],
                },
                condition: {

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
            const filter = await createScannedFilter(
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
            } = await await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'location', operation: 'remove' },
                    ],
                },
                condition: {

                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });

            expect(errors).toHaveLength(2);
            expect(errors[0].message).toBe(
                'Network rule with $removeheader modifier contains some of the unsupported headers',
            );
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(4);
            expect(errors[1].message).toBe(
                'Network rule with $removeheader modifier contains some of the unsupported headers',
            );
            expect((errors[1] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(106);
        });

        it('converts removeheader rules for responseHeaders and skips general allowlist rule', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                [
                    '||example.org$removeheader=refresh',
                    '||example.org$removeheader=location',
                    '@@||example.org/path/$removeheader',
                ],
            );

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
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

                    resourceTypes: allResourcesTypes,
                },
            });
        });

        // eslint-disable-next-line max-len
        it('converts $removeheader rules for responseHeaders and skips general allowlist rule and for other domain', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                [
                    '||example.org^$removeheader=refresh',
                    '||example.org^$removeheader=location',
                    '||example.com^$removeheader=refresh',
                    '@@||example.org^$removeheader',
                ],
            );

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(2);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
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

                    resourceTypes: allResourcesTypes,
                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [
                        { header: 'refresh', operation: 'remove' },
                    ],
                },
                condition: {
                    urlFilter: '||example.com^',

                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('skips convert bad values', async () => {
            const badRule = '||example.com$removeheader=dnt:1';
            const filter = await createScannedFilter(0, [badRule]);

            const {
                declarativeRules,
                errors,
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toEqual(
                'Network rule with $removeheader modifier contains some of the unsupported headers',
            );
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(4);
        });

        it('combine several $removeheader rule', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
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
            } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
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

                    resourceTypes: allResourcesTypes,
                },
            });
        });
    });

    describe('check $csp', () => {
        it('converts $csp rules', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['||example.com$csp=frame-src \'none\''],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
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

                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('combine several $csp rule', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                [
                    '||example.com$csp=frame-src \'none\'',
                    '||example.com$csp=script-src \'self\' \'unsafe-eval\' http: https:',
                    '||example.com$csp=worker-src \'none\',subdocument',
                    '$csp=worker-src \'none\',domain=example.org|example.net',
                ],
            );

            const { declarativeRules } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(3);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
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

                },
            });
            expect(declarativeRules[1]).toStrictEqual({
                id: expect.any(Number),
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

                },
            });
            expect(declarativeRules[2]).toStrictEqual({
                id: expect.any(Number),
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

                },
            });
        });
    });

    describe('skips convert cosmetic exclusions modifiers without errors', () => {
        const cosmeticExclusionsModifiers = ['elemhide', 'specifichide', 'generichide'];

        it.each(cosmeticExclusionsModifiers)('skips %s', async (modifier) => {
            const badRule = `@@||example.com$${modifier}`;
            const filter = await createScannedFilter(0, [badRule]);

            const {
                declarativeRules,
                errors,
            } = await DeclarativeRulesConverter.convert([filter]);

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(0);
        });
    });

    describe('check $cookie', () => {
        it('converts $cookie rules without params', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['||example.com$cookie'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules.length).toBe(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
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
                    urlFilter: '||example.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('decline conversion $cookie rules with parameters', async () => {
            const filterId = 0;
            const rulesText = [
                '||example.com$cookie=lang',
                '||example.com$cookie=user;maxAge=3600',
                '||example.com$cookie=utm;maxAge=3600;sameSite=lax',
            ];
            const filter = await createScannedFilter(
                filterId,
                rulesText,
            );

            const {
                declarativeRules,
                errors,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(errors.length).toBe(3);

            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(3);
            expect(errors[0].message).toBe(
                'The use of additional parameters in $cookie (apart from $cookie itself) is not supported',
            );
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(4);
            expect(errors[1].message).toBe(
                'The use of additional parameters in $cookie (apart from $cookie itself) is not supported',
            );
            expect((errors[1] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(52);
            expect(errors[2].message).toBe(
                'The use of additional parameters in $cookie (apart from $cookie itself) is not supported',
            );
            expect((errors[2] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(112);
        });
    });

    describe('check $to', () => {
        it('converts $to rule with two domains', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['/ads$to=evil.com|evil.org'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {

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
            const filter = await createScannedFilter(
                filterId,
                ['/ads$to=~not.evil.com|evil.com'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toMatchObject({
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {

                    requestDomains: ['evil.com'],
                    excludedRequestDomains: ['not.evil.com'],
                    urlFilter: '/ads',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts $to rule with two excluded domains', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['/ads$to=~good.com|~good.org'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {

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
            const filter = await createScannedFilter(
                filterId,
                ['||evil.com$method=get|head'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 76,
                action: {
                    type: 'block',
                },
                condition: {
                    requestMethods: ['get', 'head'],

                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('converts rule with two restricted methods', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['||evil.com$method=~post|~put'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 2,
                action: {
                    type: 'block',
                },
                condition: {
                    excludedRequestMethods: ['post', 'put'],

                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('allowlist rule with one permitted method', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['@@||evil.com$method=get'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 100101,
                action: {
                    type: 'allow',
                },
                condition: {
                    requestMethods: ['get'],

                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('allowlist rule with two restricted methods', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['@@||evil.com$method=~post'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 100002,
                action: {
                    type: 'allow',
                },
                condition: {
                    excludedRequestMethods: ['post'],

                    urlFilter: '||evil.com',
                    resourceTypes: allResourcesTypes,
                },
            });
        });

        it('returns UnsupportedModifierError for `trace` method', async () => {
            const filterId = 0;
            const ruleText = '||evil.com$method=trace';
            const filter = await createScannedFilter(filterId, [ruleText]);

            const {
                declarativeRules,
                errors,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);

            expect(errors[0].message).toBe(
                'Network rule with $method modifier containing \'trace\' method is not supported',
            );
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toBe(4);
        });
    });

    describe('check $permissions', () => {
        it('converts $permissions rule', async () => {
            const filterId = 0;
            const rule = '||example.org^$permissions=autoplay=()';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
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
                    urlFilter: '||example.org^',
                    resourceTypes: documentResourceTypes,
                },
            });
        });

        it('converts several $permissions directives', async () => {
            const filterId = 0;
            const rule = '$domain=example.org|example.com,permissions=storage-access=()\\, сamera=()';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toStrictEqual({
                id: expect.any(Number),
                priority: 151,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: PERMISSIONS_POLICY_HEADER_NAME,
                        operation: 'append',
                        // TODO: Add special tokenization for AGTree to handle unescaped commas in some modifier values
                        value: 'storage-access=(), сamera=()',
                    }],
                },
                condition: {
                    initiatorDomains: [
                        'example.org',
                        'example.com',
                    ],
                    resourceTypes: documentResourceTypes,
                },
            });
        });

        it('should match only specified content-type modifier', async () => {
            const filterId = 0;
            const rule = '||example.com^$permissions=identity-credentials-get=(),script';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: 101,
                action: {
                    type: 'modifyHeaders',
                    responseHeaders: [{
                        header: PERMISSIONS_POLICY_HEADER_NAME,
                        operation: 'append',
                        value: 'identity-credentials-get=()',
                    }],
                },
                condition: {
                    urlFilter: '||example.com^',
                    resourceTypes: [ResourceType.Script],
                },
            });
        });
    });

    describe('check unsupported options', () => {
        it('returns UnsupportedModifierError for "genericblock" option', async () => {
            const filterId = 0;
            const ruleText = '@@||example.org^$genericblock';
            const filter = await createScannedFilter(filterId, [ruleText]);

            const {
                declarativeRules,
                errors,
            } = await DeclarativeRulesConverter.convert(
                [filter],
            );
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);

            expect(errors[0].message).toBe('Unsupported option "$genericblock"');
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toBe(4);
        });
    });
});
