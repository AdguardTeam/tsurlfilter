import { type ILookupTable } from '../../../src/engine/lookup-tables/lookup-table';
import { RuleStorage } from '../../../src/filterlist/rule-storage';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../../src/filterlist/string-rule-list';

/**
 * Creates rule storage from the given rules.
 *
 * @param rules Rules.
 *
 * @returns Created rule storage.
 */
export function createRuleStorage(rules: string[]): RuleStorage {
    const list = new StringRuleList(1, rules.join('\n'), false, false, false);
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
        const indexedRule = scanner.getRuleParts();
        if (indexedRule) {
            table.addRule(indexedRule.ruleParts, indexedRule.index);
        }
    }
}
