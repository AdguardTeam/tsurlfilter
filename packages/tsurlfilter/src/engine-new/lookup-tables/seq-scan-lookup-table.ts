import { NetworkRuleParser } from '@adguard/agtree';
import { getErrorMessage } from '@adguard/logger';

import { type ILookupTable } from './lookup-table';
import { type Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';
import { type NetworkRuleParts } from '../../filterlist/rule-parts';
import { type RuleStorage } from '../../filterlist/rule-storage-new';
import { logger } from '../../utils/logger';

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
    public addRule(rule: NetworkRuleParts, storageIdx: number): boolean {
        if (this.rules.has(storageIdx)) {
            return false;
        }

        try {
            // FIXME: double check this
            this.rules.set(
                storageIdx,
                new NetworkRule(
                    NetworkRuleParser.parse(rule.text),
                    this.ruleStorage.getFilterListId(storageIdx),
                    storageIdx,
                ),
            );
            this.rulesCount += 1;
            return true;
        } catch (e) {
            // If we failed to parse the rule, we just skip it.
            logger.debug(
                `[tsurl.SeqScanLookupTable.addRule]: failed to create rule from '${rule.text}', got error:`,
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
