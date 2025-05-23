import { type ILookupTable } from './lookup-table';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { type RuleParts } from '../../filterlist/tokenize';
import { type RuleStorage } from '../../filterlist/rule-storage';

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
    private rules: Map<number, NetworkRule> = new Map();

    /**
     * Storage for the network filtering rules.
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage.
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
    }

    /**
     * Implements the ILookupTable interface for SeqScanLookupTable.
     *
     * @param _rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     *
     * @returns True if the rule was added.
     */
    addRule(_rule: RuleParts, storageIdx: number): boolean {
        if (!this.rules.has(storageIdx)) {
            try {
                // FIXME: we need the original rule in this case
                this.rules.set(storageIdx, this.ruleStorage.retrieveNetworkRule(storageIdx)!);
                this.rulesCount += 1;
                return true;
            } catch (e) {
                // Skip invalid rules
            }
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
    matchAll(request: Request): NetworkRule[] {
        const result = [];

        for (const r of this.rules.values()) {
            if (r.match(request)) {
                result.push(r);
            }
        }

        return result;
    }
}
