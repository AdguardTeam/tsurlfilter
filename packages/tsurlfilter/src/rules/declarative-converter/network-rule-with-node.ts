import { type NetworkRule as NetworkRuleNode } from '@adguard/agtree';

import { type NetworkRule } from '../network-rule';
import { type IRule } from '../rule';

/**
 * Network rule with node.
 */
export class NetworkRuleWithNode implements IRule {
    public rule: NetworkRule;

    public node: NetworkRuleNode;

    /**
     * Creates an instance of NetworkRuleWithNode.
     *
     * @param rule Network rule.
     * @param node Network rule node.
     */
    constructor(rule: NetworkRule, node: NetworkRuleNode) {
        this.rule = rule;
        this.node = node;
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
