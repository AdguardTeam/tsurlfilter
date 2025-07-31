import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';

import { type ILookupTable } from './lookup-table';

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
    private rules: NetworkRule[] = [];

    /**
     * Implements the ILookupTable interface for SeqScanLookupTable.
     *
     * @param rule Rule to add.
     *
     * @returns True if the rule was added.
     */
    public addRule(rule: NetworkRule): boolean {
        if (!this.rules.includes(rule)) {
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
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     *
     * @param request Request to check.
     *
     * @returns Array of matching rules.
     */
    public matchAll(request: Request): NetworkRule[] {
        const result = [];

        for (let i = 0; i < this.rules.length; i += 1) {
            const r = this.rules[i];
            if (r.match(request)) {
                result.push(r);
            }
        }

        return result;
    }
}
