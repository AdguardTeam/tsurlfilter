import { type NetworkRule as NetworkRuleNode } from '@adguard/agtree';

import { type NetworkRule } from '../network-rule';
import { type IRule } from '../rule';

/**
 * Network rule with node.
 */
export class NetworkRuleWithNodeAndText implements IRule {
    public rule: NetworkRule;

    public node: NetworkRuleNode;

    public text: string;

    /**
     * Creates an instance of NetworkRuleWithNode.
     *
     * @param rule Network rule.
     * @param node Network rule node.
     * @param text Network rule text.
     */
    constructor(rule: NetworkRule, node: NetworkRuleNode, text: string) {
        this.rule = rule;
        this.node = node;
        this.text = text;
    }

    /** @inheritdoc */
    public getIndex(): number {
        return this.rule.getIndex();
    }

    /** @inheritdoc */
    public getFilterListId(): number {
        return this.rule.getFilterListId();
    }
}
