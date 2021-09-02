import { Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';

/**
 * Lookup table interface
 */
export interface ILookupTable {
    /**
     * Finds all matching rules from the shortcuts lookup table
     *
     * @param request to check
     * @return array of matching rules
     */
    matchAll(request: Request): NetworkRule[];

    /**
     * Tries to add the rule to the lookup table.
     * returns true if it was added
     *
     * @param rule to add
     * @param storageIdx index
     * @return true if the rule been added
     */
    addRule(rule: NetworkRule, storageIdx: number): boolean;

    /**
     * @return total rules count
     */
    getRulesCount(): number;
}
