import type { Request } from '../../request';
import type { NetworkRule } from '../../rules/network-rule';

/**
 * Lookup table interface.
 */
export interface ILookupTable {
    /**
     * Position of the lookup table in the byte buffer.
     */
    readonly offset: number

    /**
     * Finds all matching rules from the shortcuts lookup table.
     *
     * @param request To check.
     * @returns Array of matching rules.
     */
    matchAll(request: Request): NetworkRule[];

    /**
     * Tries to add the rule to the lookup table.
     *
     * @param rule To add.
     * @param storageIdx Index.
     * @returns True if the rule been added.
     */
    addRule(rule: NetworkRule, storageIdx: number): boolean;

    /**
     * Count of rules added to this lookup table.
     *
     * @returns Total rules count.
     */
    getRulesCount(): number;
}
