import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';

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
     * @param request Request to check.
     *
     * @returns Array of matching rules.
     */
    matchAll(request: Request): NetworkRule[];

    /**
     * @returns Total rules count.
     */
    getRulesCount(): number;
}
