import { type ILookupTable } from './lookup-table';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { type RuleParts } from '../tokenize';
import { stringArraysEquals } from '../../utils/string-utils';

/**
 * Sequence scan lookup table of rules for which we could not find a shortcut
 * and could not place it to the shortcuts lookup table.
 * In common case of rule there is always a way to just check a rule.match().
 */
export class SeqScanLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    /**
     * Rules for which we could not find a shortcut and could not place it to the shortcuts lookup table.
     */
    private rules: RuleParts[] = [];

    // FIXME
    private instances: WeakMap<RuleParts, NetworkRule> = new WeakMap();

    private hasRule(rule: RuleParts): boolean {
        return this.rules.some((r) => {
            if (r.pattern === rule.pattern) {
                if (rule.domains && r.domains) {
                    return stringArraysEquals(rule.domains, r.domains);
                }

                return true;
            }

            return false;
        });
    }

    // FIXME
    // private getRuleInstance(rule: RuleParts): NetworkRule {
    //     let instance = this.instances.get(rule);
    //     if (!instance) {
    //         instance = new NetworkRule(rule);
    //         this.instances.set(rule, instance);
    //     }
    //     return instance;
    // }

    /**
     * Implements the ILookupTable interface for SeqScanLookupTable.
     *
     * @param rule Rule to add.
     *
     * @returns True if the rule was added.
     */
    addRule(rule: RuleParts): boolean {
        if (!this.hasRule(rule)) {
            this.rules.push(rule);
            this.rulesCount += 1;
            return true;
        }

        return false;
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @returns Count of rules added to this lookup table.
     */
    getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @param request Request to check.
     *
     * @returns Array of matching rules.
     */
    // FIXME
    matchAll(request: Request): NetworkRule[] {
        // const result = [];

        // for (let i = 0; i < this.rules.length; i += 1) {
        //     const r = this.getRuleInstance(this.rules[i]);
        //     if (r.match(request)) {
        //         result.push(r);
        //     }
        // }

        // return result;

        return [];
    }
}
