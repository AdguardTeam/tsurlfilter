import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { SimpleRegex } from '../../rules/simple-regex';
import { TrieNode } from '../../utils/trie';

import { type ILookupTable } from './lookup-table';

/**
 * Look up table with underlying prefix tree.
 */
export class TrieLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    /**
     * Storage for the network filtering rules.
     */
    private readonly ruleStorage: RuleStorage;

    /**
     * Trie that stores rules' shortcuts.
     */
    private readonly trie: TrieNode;

    /**
     * Creates a new instance of the TrieLookupTable.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage) {
        this.ruleStorage = storage;
        this.trie = new TrieNode(0);
    }

    /**
     * Finds all matching rules from the shortcuts lookup table.
     *
     * @param request Request to check.
     *
     * @returns Array of matching rules.
     */
    public matchAll(request: Request): NetworkRule[] {
        const rulesIndexes = this.traverse(request);
        return this.matchRules(request, rulesIndexes);
    }

    /**
     * Tries to add the rule to the lookup table.
     * Returns true if it was added.
     *
     * @param rule Rule to add.
     * @param storageIdx Index of the rule in the storage.
     *
     * @returns True if the rule was added.
     */
    public addRule(rule: NetworkRule, storageIdx: number): boolean {
        const shortcut = rule.getShortcut();

        if (!shortcut || TrieLookupTable.isAnyURLShortcut(shortcut)
            || shortcut.length < SimpleRegex.MIN_SHORTCUT_LENGTH) {
            return false;
        }

        this.trie.add(shortcut, storageIdx);
        this.rulesCount += 1;
        return true;
    }

    /**
     * Returns total rules count.
     *
     * @returns Total rules count.
     */
    public getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * For specified request finds matching rules from rules indexes array.
     *
     * @param request Request to check.
     * @param rulesIndexes Array of rules indexes.
     *
     * @returns Array of matching rules.
     */
    private matchRules(request: Request, rulesIndexes: number[] | undefined): NetworkRule[] {
        if (!rulesIndexes) {
            return [];
        }

        const result: NetworkRule[] = [];

        for (let j = 0; j < rulesIndexes.length; j += 1) {
            const idx = rulesIndexes[j];
            const rule = this.ruleStorage.retrieveNetworkRule(idx);
            if (rule && rule.match(request, false)) {
                result.push(rule);
            }
        }

        return result;
    }

    /**
     * Traverses trie.
     *
     * @param request Request to check.
     *
     * @returns Array of numbers collected from the trie nodes.
     */
    private traverse(request: Request): number[] {
        return this.trie.traverseAll(request.urlLowercase, request.urlLowercase.length);
    }

    /**
     * Checks if the rule potentially matches too many URLs.
     * We'd better use another type of lookup table for this kind of rules.
     *
     * @param shortcut Shortcut to check.
     *
     * @returns True if the rule potentially matches too many URLs.
     */
    private static isAnyURLShortcut(shortcut: string): boolean {
        // The numbers are basically ("PROTO://".length + 1)
        if (shortcut.length < 6 && shortcut.indexOf('ws:') === 0) {
            return true;
        }

        if (shortcut.length < 7 && shortcut.indexOf('|ws') === 0) {
            return true;
        }

        if (shortcut.length < 9 && shortcut.indexOf('http') === 0) {
            return true;
        }

        return !!(shortcut.length < 10 && shortcut.indexOf('|http') === 0);
    }
}
