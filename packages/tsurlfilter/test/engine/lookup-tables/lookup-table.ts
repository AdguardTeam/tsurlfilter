import { type ILookupTable } from '../../../src/engine/lookup-tables/lookup-table';
import { BufferRuleList } from '../../../src/filterlist/buffer-rule-list';
import { FilterListPreprocessor } from '../../../src/filterlist/preprocessor';
import { RuleStorage } from '../../../src/filterlist/rule-storage';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';
import { NetworkRule } from '../../../src/rules/network-rule';

/**
 * Creates rule storage from the given rules.
 *
 * @param rules Rules.
 *
 * @returns Created rule storage.
 */
export function createRuleStorage(rules: string[]): RuleStorage {
    const preprocessed = FilterListPreprocessor.preprocess(rules.join('\n'));
    const list = new BufferRuleList(1, preprocessed.filterList, false);
    return new RuleStorage([list]);
}

/**
 * Fills lookup table with network rules.
 *
 * @param table Lookup table.
 * @param ruleStorage Rule storage.
 */
export function fillLookupTable(table: ILookupTable, ruleStorage: RuleStorage): void {
    const scanner = ruleStorage.createRuleStorageScanner(ScannerType.NetworkRules);

    while (scanner.scan()) {
        const indexedRule = scanner.getRule();
        if (indexedRule
            && indexedRule.rule instanceof NetworkRule) {
            table.addRule(indexedRule.rule, indexedRule.index);
        }
    }
}
