import {
    DeclarativeRuleConverter, DeclarativeRulePriority,
} from '../../../src/rules/declarative-converter/declarative-rule-converter';
import { NetworkRule } from '../../../src/rules/network-rule';

describe('DeclarativeRuleConverter', () => {
    it('converts simple blocking rules', () => {
        const ruleText = '||example.org^';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual({
            id: ruleId,
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
        const ruleText = '@@||example.org^';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual({
            id: ruleId,
            priority: DeclarativeRulePriority.Exception,
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
        const ruleText = '@@||example.org^$important';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual({
            id: ruleId,
            priority: DeclarativeRulePriority.ImportantException,
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
        const thirdPartyRuleText = '||example.org^$third-party';
        const ruleId = 1;
        const thirdPartyDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(thirdPartyRuleText, -1), ruleId);
        expect(thirdPartyDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'thirdParty',
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });

        const firstPartyRuleText = '||example.org^$~third-party';
        const firstPartyDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(firstPartyRuleText, -1), ruleId);
        expect(firstPartyDeclarative).toEqual({
            id: ruleId,
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
        const firstPartyRuleText = '||example.org^$first-party';
        const ruleId = 1;
        const firstPartyDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(firstPartyRuleText, -1), ruleId);
        expect(firstPartyDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                domainType: 'firstParty',
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: false,
            },
        });

        const negateFirstPartyRuleText = '||example.org^$~first-party';
        const negateFirstPartyDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(
            negateFirstPartyRuleText,
            -1,
        ), ruleId);
        expect(negateFirstPartyDeclarative).toEqual({
            id: ruleId,
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
        const domainRuleText = '||example.org^$domain=example.com';
        const ruleId = 1;
        const domainDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(domainRuleText, -1), ruleId);
        expect(domainDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                initiatorDomains: ['example.com'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const multipleDomainRuleText = '||example.org^$domain=example.com|example2.com|~example3.com|~example4.com';
        const multipleDomainDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(multipleDomainRuleText, -1),
            ruleId,
        );
        expect(multipleDomainDeclarative).toEqual({
            id: ruleId,
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

        const negateDomainRuleText = '||example.org^$domain=~example.com';
        const negateDomainDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(negateDomainRuleText, -1),
            ruleId,
        );
        expect(negateDomainDeclarative).toEqual({
            id: ruleId,
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
        const scriptRuleText = '||example.org^$script';
        const ruleId = 1;
        const scriptRuleDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(scriptRuleText, -1), ruleId);
        expect(scriptRuleDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                resourceTypes: ['script'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const negatedScriptRule = '||example.org^$~script';
        const negatedScriptRuleDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(negatedScriptRule, -1),
            ruleId,
        );
        expect(negatedScriptRuleDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedResourceTypes: ['script'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const multipleRequestTypesRule = '||example.org^$script,image,media';
        const multipleDeclarativeRule = DeclarativeRuleConverter.convert(
            new NetworkRule(multipleRequestTypesRule, -1),
            ruleId,
        );
        expect(multipleDeclarativeRule!.condition?.resourceTypes?.sort())
            .toEqual(['script', 'image', 'media'].sort());

        const multipleNegatedRequestTypesRule = '||example.org^$~script,~subdocument';
        const multipleNegatedDeclarativeRule = DeclarativeRuleConverter.convert(
            new NetworkRule(multipleNegatedRequestTypesRule, -1),
            ruleId,
        );
        expect(multipleNegatedDeclarativeRule!.condition?.excludedResourceTypes?.sort())
            .toEqual(['script', 'sub_frame'].sort());
    });

    it('set rules case sensitive if necessary', () => {
        const matchCaseRuleText = '||example.org^$match-case';
        const ruleId = 1;
        const matchCaseDeclarative = DeclarativeRuleConverter.convert(new NetworkRule(matchCaseRuleText, -1), ruleId);
        expect(matchCaseDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                isUrlFilterCaseSensitive: true,
            },
        });

        const negatedMatchCaseTextRule = '||example.org^$~match-case';
        const negatedMatchCaseDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(negatedMatchCaseTextRule, -1),
            ruleId,
        );
        expect(negatedMatchCaseDeclarative).toEqual({
            id: ruleId,
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
        const ruleText = '||*example.org^';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual({
            id: ruleId,
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
        // eslint-disable-next-line max-len
        const ruleText = '/\\.vidzi\\.tv\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/([a-f0-9]{2})\\/\\1\\2\\3([a-f0-9]{26})\\.js/$domain=vidzi.tv';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual(null);
    });

    // TODO Find how exactly the complexity of a rule is calculated
    it('More complex regex than allowed', () => {
        // eslint-disable-next-line max-len
        const ruleText = '/www\\.oka\\.fm\\/.+\\/(yuzhnyj4.gif|cel.gif|tehnoplyus.jpg|na_chb_foto_250_250.jpg|ugzemli.gif|istorii.gif|advokat.jpg|odejda-shkola.gif|russkij-svet.jpg|dveri.gif|Festival_shlyapok_2.jpg)/';
        const ruleId = 1;
        expect(() => {
            DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        }).toThrowError();
    });

    it('converts regex negative lookahead', () => {
        const ruleText = '/rustorka.\\w+\\/forum\\/(?!login.php)/$removeheader=location';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual(null);
    });

    // WebRTC resource type is not supported in Manifest V3
    it('converts WebRTC connections rules', () => {
        const ruleText = '@@$webrtc,domain=walla.co.il';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual(null);
    });

    // Cookies rules are not supported
    it('converts cookies rules', () => {
        const ruleText = '$cookie=bf_lead';
        const ruleId = 1;
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
        expect(declarativeRule).toEqual(null);
    });

    describe('converts cyrillic domain rules', () => {
        it('converts domains section', () => {
            const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule('path$domain=меил.рф', -1), 2);
            expect(declarativeRule).toEqual({
                id: 2,
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
            const declarativeRule = DeclarativeRuleConverter.convert(
                new NetworkRule('||банрек.рус^$third-party', -1),
                1,
            );
            expect(declarativeRule).toEqual({
                id: 1,
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

    it('converts redirect rules', () => {
        const resourcesPath = '/war/redirects';
        const ruleId = 1;

        DeclarativeRuleConverter.WebAccesibleResoursesPath = resourcesPath;
        const result = DeclarativeRuleConverter.convert(
            new NetworkRule('||example.org/script.js$script,redirect=noopjs', -1),
            ruleId,
        );
        expect(result).toStrictEqual({
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
            id: ruleId,
        });
    });

    describe('converts denyallow rules', () => {
        it('converts denyallow simple rule', () => {
            const ruleId = 1;

            const result = DeclarativeRuleConverter.convert(
                new NetworkRule(
                    '/adguard_circle.png$image,denyallow=cdn.adguard.com,domain=testcases.adguard.com|surge.sh',
                    -1,
                ),
                ruleId,
            );
            expect(result).toStrictEqual({
                id: ruleId,
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
            const ruleId = 1;

            const result = DeclarativeRuleConverter.convert(
                new NetworkRule(
                    // eslint-disable-next-line max-len
                    '@@/adguard_dns_map.png$image,denyallow=cdn.adguard.com|fastcdn.adguard.com,domain=testcases.adguard.com|surge.sh',
                    -1,
                ),
                ruleId,
            );
            expect(result).toStrictEqual({
                priority: 1,
                id: ruleId,
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
            const ruleText = '||example.com$removeparam=param';
            const ruleId = 1;

            const networkRule = new NetworkRule(ruleText, -1);
            const declarativeRule = DeclarativeRuleConverter.convert(networkRule, ruleId);
            expect(declarativeRule).toEqual({
                id: ruleId,
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
            const ruleText = '||example.com$removeparam';
            const ruleId = 1;

            const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
            expect(declarativeRule).toEqual({
                id: ruleId,
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

        it('converts $removeparam resource type xmlhttprequest', () => {
            const ruleText = '||testcases.adguard.com$xmlhttprequest,removeparam=p2case2';
            const ruleId = 1;

            const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule(ruleText, -1), ruleId);
            expect(declarativeRule).toEqual({
                id: ruleId,
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
});
