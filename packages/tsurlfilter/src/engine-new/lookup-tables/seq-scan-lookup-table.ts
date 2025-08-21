import { getErrorMessage } from '@adguard/logger';

import { type NetworkRuleParts } from '../../filterlist/rule-parts';
import { type RuleStorage } from '../../filterlist/rule-storage-new';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { logger } from '../../utils/logger';

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

    /** @inheritdoc */
    public addRule(parts: NetworkRuleParts, storageIdx: number): boolean {
        if (this.rules.has(storageIdx)) {
            return false;
        }

        try {
            const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);

            if (!rule) {
                return false;
            }

            this.rules.set(
                storageIdx,
                rule,
            );
            this.rulesCount += 1;
            return true;
        } catch (e) {
            // If we failed to parse the rule, we just skip it.
            logger.debug(
                `[tsurl.SeqScanLookupTable.addRule]: failed to create rule from '${parts.text}', got error:`,
                getErrorMessage(e),
            );

            return false;
        }
    }

    /** @inheritdoc */
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /** @inheritdoc */
    public matchAll(request: Request): NetworkRule[] {
        const result = [];

        for (const r of this.rules.values()) {
            if (r.match(request)) {
                result.push(r);
            }
        }

        return result;
    }
}
