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
        const firstPartyDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(firstPartyRuleText, -1), ruleId,
        );
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
        const negateFirstPartyDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(negateFirstPartyRuleText, -1), ruleId,
        );
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
                domains: ['example.com'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const multipleDomainRuleText = '||example.org^$domain=example.com|example2.com|~example3.com|~example4.com';
        const multipleDomainDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(multipleDomainRuleText, -1), ruleId,
        );
        expect(multipleDomainDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                domains: ['example.com', 'example2.com'],
                excludedDomains: ['example3.com', 'example4.com'],
                isUrlFilterCaseSensitive: false,
            },
        });

        const negateDomainRuleText = '||example.org^$domain=~example.com';
        const negateDomainDeclarative = DeclarativeRuleConverter.convert(
            new NetworkRule(negateDomainRuleText, -1), ruleId,
        );
        expect(negateDomainDeclarative).toEqual({
            id: ruleId,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: '||example.org^',
                excludedDomains: ['example.com'],
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
            new NetworkRule(negatedScriptRule, -1), ruleId,
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
            new NetworkRule(multipleRequestTypesRule, -1), ruleId,
        );
        expect(multipleDeclarativeRule!.condition?.resourceTypes?.sort())
            .toEqual(['script', 'image', 'media'].sort());

        const multipleNegatedRequestTypesRule = '||example.org^$~script,~subdocument';
        const multipleNegatedDeclarativeRule = DeclarativeRuleConverter.convert(
            new NetworkRule(multipleNegatedRequestTypesRule, -1), ruleId,
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
            new NetworkRule(negatedMatchCaseTextRule, -1), ruleId,
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

    it('converts cyrillic domain rules', () => {
        const declarativeRule = DeclarativeRuleConverter.convert(new NetworkRule('path$domain=меил.рф', -1), 2);
        expect(declarativeRule).toEqual({
            id: 2,
            action: {
                type: 'block',
            },
            condition: {
                urlFilter: 'path',
                isUrlFilterCaseSensitive: false,
                domains: [
                    'xn--e1agjb.xn--p1ai',
                ],
            },
        });
    });
});
