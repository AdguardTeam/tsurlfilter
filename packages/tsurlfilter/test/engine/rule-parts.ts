import { type RuleStorage } from '../../src/filterlist/rule-storage';
import { type ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { type IndexedStorageCosmeticRuleParts, type IndexedStorageNetworkRuleParts } from '../../src/rules/rule';

/**
 * Scans the given rule storage and collects the rule parts of the requested
 * scanner type. Shared by the engine tests and benches so the collection
 * semantics live in one place instead of five near-identical loops.
 *
 * @param storage Rule storage to scan.
 * @param scannerType Type of rules to collect.
 *
 * @returns Collected rule parts.
 */
export function collectRuleParts<T extends IndexedStorageNetworkRuleParts | IndexedStorageCosmeticRuleParts>(
    storage: RuleStorage,
    scannerType: ScannerType,
): T[] {
    const scanner = storage.createRuleStorageScanner(scannerType);
    const parts: T[] = [];

    while (scanner.scan()) {
        parts.push(scanner.getRuleParts()! as T);
    }

    return parts;
}
