import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';

/**
 * Lookup table interface.
 */
export interface ILookupTable {
    /**
     * Finds all matching rules from the shortcuts lookup table.
     *
     * @param request Request to check.
     *
     * @returns Array of matching rules.
     */
    matchAll(request: Request): NetworkRule[];

    /**
     * Tries to add the rule to the lookup table.
     * Returns true if it was added.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     *
     * @returns True if the rule was added.
     */
    addRule(rule: NetworkRule, storageIdx: number): boolean;

    /**
     * @returns Total rules count.
     */
    getRulesCount(): number;
}
