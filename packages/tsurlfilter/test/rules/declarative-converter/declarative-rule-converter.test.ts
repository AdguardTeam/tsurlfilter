import {
    beforeAll,
    describe,
    expect,
    it,
} from 'vitest';

import { CSP_HEADER_NAME } from '../../../src/modifiers/csp-modifier';
import { PERMISSIONS_POLICY_HEADER_NAME } from '../../../src/modifiers/permissions-modifier';
import { POPULAR_TLDS } from '../../../src/rules/declarative-converter/constants/popular-tlds';
import { ResourceType } from '../../../src/rules/declarative-converter/declarative-rule';
import { type InvalidDeclarativeRuleError } from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { re2Validator } from '../../../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../../../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import { DeclarativeRulesConverter } from '../../../src/rules/declarative-converter/rules-converter';
import { createNetworkRuleWithNode } from '../../helpers/rule-creator';

import { createScannedFilter } from './helpers';

const allResourcesTypes = Object.values(ResourceType);
const documentResourceTypes = [ResourceType.MainFrame, ResourceType.SubFrame];

describe('DeclarativeRulesConverter', () => {
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

    it('expands all popular TLDs once for a wildcard $domain modifier', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||*/httpbin/anything/test-case-2.json$domain=testcases.agrd.*'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        const initiatorDomains = declarativeRule.condition.initiatorDomains ?? [];
        const expectedInitiatorDomains = POPULAR_TLDS.map((tld) => `testcases.agrd.${tld}`);

        expect(initiatorDomains).toEqual(expect.arrayContaining([
            'testcases.agrd.com',
            'testcases.agrd.co.uk',
        ]));
        expect([...initiatorDomains].sort()).toEqual([...expectedInitiatorDomains].sort());
    });

    it('expands multiple wildcard TLD domains in $domain modifiers', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||*/httpbin/anything/test-case-2.json$domain=testcases.agrd.*|pages.*'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        const initiatorDomains = declarativeRule.condition.initiatorDomains ?? [];

        expect(initiatorDomains).toEqual(expect.arrayContaining([
            'testcases.agrd.com',
            'testcases.agrd.co.uk',
            'pages.com',
            'pages.co.uk',
        ]));
        expect(initiatorDomains).toHaveLength(POPULAR_TLDS.length * 2);
    });

    it('expands negated wildcard TLD domains in $domain modifiers', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||ads.example.org^$domain=~trusted.*'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        const excludedInitiatorDomains = declarativeRule.condition.excludedInitiatorDomains ?? [];

        expect(excludedInitiatorDomains).toEqual(expect.arrayContaining([
            'trusted.com',
            'trusted.co.uk',
        ]));
        expect(excludedInitiatorDomains).toHaveLength(POPULAR_TLDS.length);
    });

    it('keeps concrete domains and deduplicates expanded wildcard TLD domains', async () => {
        const filterId = 0;

        const filter = await createScannedFilter(
            filterId,
            ['||ad.js$domain=specific.com|wild.com|wild.*|~evil.*'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        const initiatorDomains = declarativeRule.condition.initiatorDomains ?? [];
        const excludedInitiatorDomains = declarativeRule.condition.excludedInitiatorDomains ?? [];

        expect(initiatorDomains).toEqual(expect.arrayContaining([
            'specific.com',
            'wild.com',
            'wild.co.uk',
        ]));
        expect(initiatorDomains.filter((domain) => domain === 'wild.com')).toHaveLength(1);
        expect(initiatorDomains).toHaveLength(POPULAR_TLDS.length + 1);
        expect(excludedInitiatorDomains).toEqual(expect.arrayContaining([
            'evil.com',
            'evil.co.uk',
        ]));
    });

    it('converts wildcard TLD domains to ASCII after expansion', async () => {
        const filterId = 0;
        const filter = await createScannedFilter(
            filterId,
            ['||example.org/ad.js$domain=münchen.*'],
        );

        const {
            declarativeRules: [declarativeRule],
        } = await DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRule.condition.initiatorDomains).toContain('xn--mnchen-3ya.com');
        expect(declarativeRule.condition.initiatorDomains).not.toContain('münchen.com');
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

        const networkRule = createNetworkRuleWithNode(regexpRuleText, filterId, 0);

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
                    urlFilter: '||example.com*^param=',
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

        it('does not merge $removeparam rules (param-aware urlFilter)', async () => {
            const filterId = 0;
            const rules = [
                '||testcases.adguard.com$xmlhttprequest,removeparam=p1case1',
                '||testcases.adguard.com$xmlhttprequest,removeparam=p2case1',
                '||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1',
                '$xmlhttprequest,removeparam=p1case2',
            ];
            const filter = await createScannedFilter(filterId, rules);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            // Rules are no longer merged because each has a unique
            // param-aware urlFilter, enabling multi-hop redirect chaining.
            expect(declarativeRules).toHaveLength(4);

            const findByParam = (param: string) => declarativeRules.find(
                (r) => r.action.redirect?.transform?.queryTransform?.removeParams?.[0] === param,
            );

            expect(findByParam('p1case1')).toStrictEqual({
                id: expect.any(Number),
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['p1case1'],
                            },
                        },
                    },
                },
                condition: {
                    urlFilter: '||testcases.adguard.com*^p1case1=',
                    resourceTypes: [ResourceType.XmlHttpRequest],
                },
            });
            expect(findByParam('p2case1')).toStrictEqual({
                id: expect.any(Number),
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['p2case1'],
                            },
                        },
                    },
                },
                condition: {
                    urlFilter: '||testcases.adguard.com*^p2case1=',
                    resourceTypes: [ResourceType.XmlHttpRequest],
                },
            });
            expect(findByParam('P3Case1')).toStrictEqual({
                id: expect.any(Number),
                priority: 101,
                action: {
                    type: 'redirect',
                    redirect: {
                        transform: {
                            queryTransform: {
                                removeParams: ['P3Case1'],
                            },
                        },
                    },
                },
                condition: {
                    urlFilter: '||testcases.adguard.com*^P3Case1=',
                    resourceTypes: [ResourceType.XmlHttpRequest],
                },
            });
            expect(findByParam('p1case2')).toStrictEqual({
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
                    urlFilter: '^p1case2=',
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
                    urlFilter: '||testcases.adguard.com*^p2case2=',
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
                    urlFilter: '||example.com^*^id=',
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
                    urlFilter: '||example.com*^$param=',
                    resourceTypes: documentResourceTypes,
                },
            });
        });

        it('generic removeparam rules produce param-aware urlFilter for multi-hop chaining', async () => {
            const filterId = 0;
            const rules = [
                '$removeparam=utm_source',
                '$removeparam=utm_medium',
                '$removeparam=utm_campaign',
            ];
            const filter = await createScannedFilter(filterId, rules);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(3);

            const findByParam = (param: string) => declarativeRules.find(
                (r) => r.action.redirect?.transform?.queryTransform?.removeParams?.[0] === param,
            );

            for (const param of ['utm_source', 'utm_medium', 'utm_campaign']) {
                const rule = findByParam(param);
                expect(rule).toBeDefined();
                expect(rule!.condition.urlFilter).toBe(`^${param}=`);
                expect(rule!.action.redirect?.transform?.queryTransform?.removeParams).toEqual([param]);
                expect(rule!.condition.resourceTypes).toEqual(documentResourceTypes);
            }
        });

        it('domain-scoped and generic removeparam rules coexist with param-aware urlFilter', async () => {
            const filterId = 0;
            const rules = [
                '$removeparam=utm_campaign',
                '||adguard.$removeparam=clid',
            ];
            const filter = await createScannedFilter(filterId, rules);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(2);

            const findByParam = (param: string) => declarativeRules.find(
                (r) => r.action.redirect?.transform?.queryTransform?.removeParams?.[0] === param,
            );

            const utmRule = findByParam('utm_campaign');
            expect(utmRule).toBeDefined();
            expect(utmRule!.condition.urlFilter).toBe('^utm_campaign=');

            const clidRule = findByParam('clid');
            expect(clidRule).toBeDefined();
            expect(clidRule!.condition.urlFilter).toBe('||adguard.*^clid=');
        });

        it('regex removeparam is not supported and does not get param-aware urlFilter', async () => {
            const filterId = 0;
            const rule = '||example.com$removeparam=/^utm_/';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules, errors } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toBe(
                'Network rule with $removeparam modifier with negation or regexp is not supported',
            );
        });

        it('negation removeparam is not supported and does not get param-aware urlFilter', async () => {
            const filterId = 0;
            const rule = '||example.com$removeparam=~param';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules, errors } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toBe(
                'Network rule with $removeparam modifier with negation or regexp is not supported',
            );
        });

        it('empty removeparam preserves strip-all behavior without param token', async () => {
            const filterId = 0;
            const rule = '||example.com^$removeparam';
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
                    urlFilter: '||example.com^',
                    resourceTypes: documentResourceTypes,
                },
            });
        });

        it('removeparam with value that cannot be decoded produces a conversion error', async () => {
            const filterId = 0;
            const rule = '||example.com^$removeparam=%E0%A4%A';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules, errors } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(0);
            expect(errors).toHaveLength(1);
            expect(errors[0].message).toBe(
                'Network rule with $removeparam modifier contains value that cannot be decoded',
            );
        });

        it('whitespace-only removeparam does not get param-aware urlFilter', async () => {
            const filterId = 0;
            const rule = '||example.com^$removeparam=%20';
            const filter = await createScannedFilter(filterId, [rule]);

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);

            // Should have redirect action but no param-aware urlFilter token.
            expect(declarativeRules[0].action).toEqual({
                type: 'redirect',
                redirect: {
                    transform: {
                        queryTransform: {
                            removeParams: [' '],
                        },
                    },
                },
            });
            expect(declarativeRules[0].condition.urlFilter).toBe('||example.com^');
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
        expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(0);
        expect(errors[1].message).toEqual('Network rule with explicitly enabled $popup modifier is not supported');
        expect((errors[1] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(21);
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
            } = await DeclarativeRulesConverter.convert([filter]);
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
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(0);
            expect(errors[1].message).toBe(
                'Network rule with $removeheader modifier contains some of the unsupported headers',
            );
            expect((errors[1] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(70);
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
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(0);
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

    describe('$header modifier', () => {
        it('converts $header rule with only a header name', async () => {
            const filter = await createScannedFilter(
                0,
                ['||example.com$header=location'],
            );

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: expect.any(Number),
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: '||example.com',
                    responseHeaders: [{ header: 'location' }],
                },
            });
        });

        it('converts $header rule with a header name and value', async () => {
            const filter = await createScannedFilter(
                0,
                ['||example.com$header=location:value123'],
            );

            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: expect.any(Number),
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: '||example.com',
                    responseHeaders: [{ header: 'location', values: ['value123'] }],
                },
            });
        });

        it('throws an error for a $header rule if the value is a regex', async () => {
            const filter = await createScannedFilter(
                0,
                ['||example.com$header=location:/value123/'],
            );
            const { declarativeRules, errors } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(0);
            expect(errors[0].message).toEqual(
                'Declarative network rules with $header modifier cannot contain regex values',
            );
        });

        it('converts $header rules with specific request types', async () => {
            const filter = await createScannedFilter(
                0,
                ['||example.com$script,header=location:value123'],
            );
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules[0]).toEqual({
                id: expect.any(Number),
                priority: expect.any(Number),
                action: {
                    type: 'block',
                },
                condition: {
                    urlFilter: '||example.com',
                    resourceTypes: ['script'],
                    responseHeaders: [{ header: 'location', values: ['value123'] }],
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
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(0);
            expect(errors[1].message).toBe(
                'The use of additional parameters in $cookie (apart from $cookie itself) is not supported',
            );
            expect((errors[1] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(26);
            expect(errors[2].message).toBe(
                'The use of additional parameters in $cookie (apart from $cookie itself) is not supported',
            );
            expect((errors[2] as InvalidDeclarativeRuleError).networkRule.getIndex()).toEqual(64);
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

        it('expands wildcard TLD domains in $to modifiers', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['/ads$to=tracker.*|specific.com'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert([filter]);

            const requestDomains = declarativeRules[0].condition.requestDomains ?? [];

            expect(declarativeRules).toHaveLength(1);
            expect(requestDomains).toEqual(expect.arrayContaining([
                'tracker.com',
                'tracker.co.uk',
                'specific.com',
            ]));
            expect(requestDomains).toHaveLength(POPULAR_TLDS.length + 1);
        });

        it('expands negated wildcard TLD domains in $to modifiers', async () => {
            const filterId = 0;
            const filter = await createScannedFilter(
                filterId,
                ['/ads$to=~safe.*|tracker.com'],
            );

            const {
                declarativeRules,
            } = await DeclarativeRulesConverter.convert([filter]);

            const excludedRequestDomains = declarativeRules[0].condition.excludedRequestDomains ?? [];

            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.requestDomains).toEqual(['tracker.com']);
            expect(excludedRequestDomains).toEqual(expect.arrayContaining([
                'safe.com',
                'safe.co.uk',
            ]));
            expect(excludedRequestDomains).toHaveLength(POPULAR_TLDS.length);
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
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toBe(0);
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
            expect((errors[0] as InvalidDeclarativeRuleError).networkRule.getIndex()).toBe(0);
        });
    });

    describe('$urltransform modifier', () => {
        it('converts full-URL $urltransform to redirect with regexSubstitution', async () => {
            const filter = await createScannedFilter(0, [
                // eslint-disable-next-line max-len
                '||old.example.com^$urltransform=/^https:\\/\\/old\\.example\\.com\\/(.*)/https:\\/\\/new.example.net\\/\\$1/',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action.type).toBe('redirect');
            expect(declarativeRules[0].action.redirect?.regexSubstitution).toBeDefined();
            expect(declarativeRules[0].condition.regexFilter).toBeDefined();
            // urlFilter must not be present
            expect(declarativeRules[0].condition.urlFilter).toBeUndefined();
            // Domain scope must be preserved
            expect(declarativeRules[0].condition.requestDomains).toEqual(['old.example.com']);
            // Should include main_frame in resourceTypes
            expect(declarativeRules[0].condition.resourceTypes).toContain('main_frame');
        });

        it('converts path-only $urltransform with origin wrapping', async () => {
            const filter = await createScannedFilter(0, [
                '||example.org^$urltransform=/\\/old\\//\\/new\\//',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toMatchObject({
                action: {
                    type: 'redirect',
                    redirect: {
                        regexSubstitution: '\\1/new/\\2',
                    },
                },
                condition: {
                    regexFilter: '^(https?://[^/]+)/old/(.*)',
                    requestDomains: ['example.org'],
                },
            });
            // Should include main_frame in resourceTypes
            expect(declarativeRules[0].condition.resourceTypes).toContain('main_frame');
        });

        it('converts $urltransform allowlist rule to allow action', async () => {
            const filter = await createScannedFilter(0, [
                '@@||example.com^$urltransform',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].action.type).toBe('allow');
        });

        it('converts 2-stage pipeline $urltransform into 2 DNR rules', async () => {
            const filter = await createScannedFilter(0, [
                '||example.com^$urltransform=/\\/old\\//\\/new\\//|/tracking-/clean-/',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules.length).toBe(2);
            expect(declarativeRules[0].action.type).toBe('redirect');
            expect(declarativeRules[1].action.type).toBe('redirect');
            expect(declarativeRules[0].condition.regexFilter).toContain('/old/');
            expect(declarativeRules[1].condition.regexFilter).toContain('tracking-');
            // Both rules should preserve domain scope
            expect(declarativeRules[0].condition.requestDomains).toEqual(['example.com']);
            expect(declarativeRules[1].condition.requestDomains).toEqual(['example.com']);
        });

        it('reports $urltransform with pct decode as unsupported error', async () => {
            const filter = await createScannedFilter(0, [
                '||tracker.example.com^$urltransform=/\\/redir\\?url=([^&]*)/\\$1/|pct',
            ]);
            const { declarativeRules, errors } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(0);
            expect(errors.length).toBeGreaterThan(0);
        });

        it('converts $urltransform with /i flag correctly', async () => {
            const filter = await createScannedFilter(0, [
                // eslint-disable-next-line max-len
                '||tracker.example.com^$urltransform=/^https:\\/\\/TRACKER\\.example\\.com\\/(.*)/https:\\/\\/clean.example.com\\/\\$1/i',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.isUrlFilterCaseSensitive).toBe(false);
            // Domain scope preserved
            expect(declarativeRules[0].condition.requestDomains).toEqual(['tracker.example.com']);
        });

        it('does not add requestDomains for wildcard patterns', async () => {
            const filter = await createScannedFilter(0, [
                '*$urltransform=/\\/old\\//\\/new\\//,domain=example.org',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            // Domain constraint comes from initiatorDomains (from $domain), not requestDomains
            expect(declarativeRules[0].condition.initiatorDomains).toEqual(['example.org']);
        });

        it('defaults to all resource types when no content type modifiers', async () => {
            const filter = await createScannedFilter(0, [
                '||example.org^$urltransform=/\\/old\\//\\/new\\//',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.resourceTypes).toEqual(allResourcesTypes);
        });

        it('defaults to all resource types for full-URL mode without content types', async () => {
            const filter = await createScannedFilter(0, [
                // eslint-disable-next-line max-len
                '||old.example.com^$urltransform=/^https:\\/\\/old\\.example\\.com\\/(.*)/https:\\/\\/new.example.net\\/\\$1/',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.resourceTypes).toEqual(allResourcesTypes);
        });

        it('respects explicit $script content type modifier', async () => {
            const filter = await createScannedFilter(0, [
                '||example.org^$urltransform=/\\/old\\//\\/new\\/,script',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.resourceTypes).toEqual([ResourceType.Script]);
        });

        it('respects multiple explicit content type modifiers', async () => {
            const filter = await createScannedFilter(0, [
                '||example.org^$urltransform=/\\/old\\//\\/new\\/,script,xmlhttprequest',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.resourceTypes).toEqual(
                expect.arrayContaining([ResourceType.Script, ResourceType.XmlHttpRequest]),
            );
            expect(declarativeRules[0].condition.resourceTypes).toHaveLength(2);
        });

        it('respects excluded content type modifier (~image)', async () => {
            const filter = await createScannedFilter(0, [
                '||example.org^$urltransform=/\\/old\\//\\/new\\/,~image',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.excludedResourceTypes).toContain(ResourceType.Image);
        });

        it('converts $urltransform with $method=get correctly', async () => {
            const filter = await createScannedFilter(0, [
                '||example.org^$urltransform=/\\/old\\//\\/new\\/,method=get',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.requestMethods).toEqual(['get']);
            // $method triggers shouldMatchAllResourcesTypes, so all resource types are set
            expect(declarativeRules[0].condition.resourceTypes).toEqual(allResourcesTypes);
        });

        it('converts full-URL $urltransform without capture groups (no crash)', async () => {
            // This rule caused a crash because escaped slashes (\/) in the
            // replacement were left as-is. Chrome DNR interprets \ in
            // regexSubstitution as a backreference prefix, so \/ is invalid.
            const filter = await createScannedFilter(0, [
                String.raw`||example.org^$urltransform=/^https:\/\/example.org/https:\/\/httpbin.agrd.dev/`,
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toMatchObject({
                action: {
                    type: 'redirect',
                    redirect: {
                        regexSubstitution: 'https://httpbin.agrd.dev',
                    },
                },
                condition: {
                    regexFilter: '^https://example.org',
                    requestDomains: ['example.org'],
                },
            });
            // urlFilter must not be present alongside regexFilter
            expect(declarativeRules[0].condition.urlFilter).toBeUndefined();
            // regexSubstitution must not contain \/ (invalid DNR escape)
            expect(declarativeRules[0].action.redirect?.regexSubstitution).not.toContain('\\/');
        });

        // Testcase rules from rules_2.md
        it('Case 1: converts path-only $urltransform with ^ and \\$ anchors', async () => {
            const filter = await createScannedFilter(0, [
                String.raw`||httpbin.agrd.dev^$urltransform=/^\/status\/500\$/\/status\/200/`,
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0]).toMatchObject({
                action: {
                    type: 'redirect',
                    redirect: {
                        regexSubstitution: '\\1/status/200',
                    },
                },
                condition: {
                    regexFilter: '^(https?://[^/]+)/status/500$',
                    requestDomains: ['httpbin.agrd.dev'],
                },
            });
        });

        it('Case 2: floating path-only $urltransform does not restrict to GET-only', async () => {
            // ||httpbin.agrd.dev^$urltransform=/royalmail/post/
            // This is a path-only (non-origin-changing) rule, so it
            // should NOT be restricted to GET-only.
            const filter = await createScannedFilter(0, [
                '||httpbin.agrd.dev^$urltransform=/royalmail/post/',
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            // path-only rules don't get requestMethods restriction
            expect(declarativeRules[0].condition.requestMethods).toBeUndefined();
        });

        it('Case 3: full-URL $urltransform defaults to GET-only', async () => {
            // ||example.org^$urltransform=/^https:\/\/example.org/https:\/\/httpbin.agrd.dev/
            const filter = await createScannedFilter(0, [
                String.raw`||example.org^$urltransform=/^https:\/\/example.org/https:\/\/httpbin.agrd.dev/`,
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            // Full-URL mode defaults to GET-only to prevent discarding POST bodies
            expect(declarativeRules[0].condition.requestMethods).toEqual(['get']);
        });

        it('Case 5: $urltransform with $script modifier has correct resourceTypes', async () => {
            const filter = await createScannedFilter(0, [
                String.raw`||httpbin.agrd.dev^$script,urltransform=/^\/status\/502\$/\/status\/200/`,
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.resourceTypes).toEqual([ResourceType.Script]);
            expect(declarativeRules[0].condition.regexFilter).toBe('^(https?://[^/]+)/status/502$');
        });

        it('Case 6: $urltransform with $image modifier has correct resourceTypes', async () => {
            const filter = await createScannedFilter(0, [
                String.raw`||httpbin.agrd.dev^$image,urltransform=/^\/status\/503\$/\/image\/png/`,
            ]);
            const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);
            expect(declarativeRules).toHaveLength(1);
            expect(declarativeRules[0].condition.resourceTypes).toEqual([ResourceType.Image]);
            expect(declarativeRules[0].condition.regexFilter).toBe('^(https?://[^/]+)/status/503$');
            expect(declarativeRules[0].action.redirect?.regexSubstitution).toBe('\\1/image/png');
        });
    });

    it('ignores /g flag in $urltransform (MV3 DNR replaces only first match)', async () => {
        const withGlobalFilter = await createScannedFilter(0, [
            '||example.org^$urltransform=/tracking-/clean-/g',
        ]);
        const withoutGlobalFilter = await createScannedFilter(0, [
            '||example.org^$urltransform=/tracking-/clean-/',
        ]);

        const {
            declarativeRules: [withGlobalRule],
        } = await DeclarativeRulesConverter.convert([withGlobalFilter]);

        const {
            declarativeRules: [withoutGlobalRule],
        } = await DeclarativeRulesConverter.convert([withoutGlobalFilter]);

        expect(withGlobalRule.action.redirect?.regexSubstitution)
            .toBe(withoutGlobalRule.action.redirect?.regexSubstitution);
        expect(withGlobalRule.condition.regexFilter)
            .toBe(withoutGlobalRule.condition.regexFilter);
        expect(withGlobalRule.condition.isUrlFilterCaseSensitive).toBeUndefined();
    });

    it('keeps multiple matching $urltransform rules separate; priority decides the winner in MV3', async () => {
        const filter = await createScannedFilter(0, [
            '||example.org^$urltransform=/foo/bar/',
            '||example.org^$urltransform=/foo/baz/,important',
        ]);

        const { declarativeRules } = await DeclarativeRulesConverter.convert([filter]);

        expect(declarativeRules).toHaveLength(2);

        const regularRule = declarativeRules.find(
            (rule) => rule.action.redirect?.regexSubstitution === '\\1bar\\2',
        );
        const importantRule = declarativeRules.find(
            (rule) => rule.action.redirect?.regexSubstitution === '\\1baz\\2',
        );

        expect(regularRule).toBeDefined();
        expect(importantRule).toBeDefined();
        expect(importantRule?.priority).toBeGreaterThan(regularRule?.priority ?? 0);
    });
});
