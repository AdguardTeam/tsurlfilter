/* eslint-disable class-methods-use-this */
import { parse } from 'tldts';

import { RuleFactory } from '../rules/rule-factory';
import { NetworkRule } from '../rules/network-rule';
import { CosmeticRule } from '../rules/cosmetic-rule';

export class RulesRemover {
    public static clearRules(url: string, rulesText: string): string {
        const CUSTOM_FILTER_ID = 0;
        const rulesTextStrings = rulesText.split('\n');

        const { hostname } = parse(url);

        if (!hostname) {
            return rulesText;
        }

        const filteredTextStrings = rulesTextStrings.filter((ruleText: string) => {
            const rule = RuleFactory.createRule(ruleText, CUSTOM_FILTER_ID) as (NetworkRule | CosmeticRule | null);
            if (!rule) {
                return true;
            }

            if (rule.matchesPermittedDomains(hostname)) {
                return false;
            }

            return true;
        });

        return filteredTextStrings.join('\n');
    }
}
