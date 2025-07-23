import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { type RuleParts } from '../../filterlist/rule-parts';

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
     * @param rule Parts of rule to add.
     * @param storageIdx Index of the rule in the storage.
     *
     * @returns True if the rule was added.
     */
    addRule(rule: RuleParts, storageIdx: number): boolean;

    /**
     * @returns Total rules count.
     */
    getRulesCount(): number;
}
