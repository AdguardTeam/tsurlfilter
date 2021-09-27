import {
    NetworkRule, RuleStorage, StringRuleList,
} from '../../../src';
import { ScannerType } from '../../../src/filterlist/scanner/scanner-type';
import { ILookupTable } from '../../../src/engine/lookup-tables/lookup-table';

export function createRuleStorage(rules: string[]): RuleStorage {
    const list = new StringRuleList(1, rules.join('\n'), true);
    return new RuleStorage([list]);
}

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
