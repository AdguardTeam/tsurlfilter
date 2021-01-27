/* eslint-disable prefer-template */
import { RulesRemover } from '../../src/utils/rules-remover';

describe('RulesRemover', () => {
    it('removes rules matched by permitted domains', () => {
        const nonMatchingRuleText = 'example.com##h1';
        const rulesText = `example.org##h1
${nonMatchingRuleText}
||example.org/favicon.ico^$domain=example.org`;

        const url = 'example.org';

        const updatedRulesText = RulesRemover.clearRules(url, rulesText);

        expect(updatedRulesText).toBe(nonMatchingRuleText);
    });
});
