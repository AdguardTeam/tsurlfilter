import { type AnyRule } from '@adguard/agtree';

import { HostRule } from '../rules/host-rule';
import { NetworkRule } from '../rules/network-rule';
import { type IRule } from '../rules/rule';
import { RuleFactory } from '../rules/rule-factory';
import { logger } from '../utils/logger';

import { type IRuleList } from './rule-list';
import { type RuleScanner } from './scanner/rule-scanner';
import { RuleStorageScanner } from './scanner/rule-storage-scanner';
import { type ScannerType } from './scanner/scanner-type';

/**
 * RuleStorage is an abstraction that combines several rule lists
 * It can be scanned using RuleStorageScanner, and also it allows
 * retrieving rules by its index.
 *
 * The idea is to keep rules in a serialized format (even original format in the case of FileRuleList)
 * and create them in a lazy manner only when we really need them. When the filtering engine is
 * being initialized, we need to scan the rule lists once in order to fill up the lookup tables.
 * We use rule indexes as a unique rule identifier instead of the rule itself.
 * The rule is created (see RetrieveRule) only when there's a chance that it's needed.
 *
 * Rule index is an int64 value that actually consists of two int32 values:
 * One is the rule list identifier, and the second is the index of the rule inside of that list.
 */
export class RuleStorage {
    /**
     * Lists is an array of rules lists which can be accessed using this RuleStorage.
     */
    private readonly lists: IRuleList[];

    /**
     * Map with rule lists. Map key is the list ID.
     */
    private readonly listsMap: Map<number, IRuleList>;

    /**
     * Cache with the rules which are stored inside this cache instance..
     */
    private readonly cache: Map<number, IRule>;

    /**
     * Api for managing rule scanners for each filter list.
     */
    declare private scanner: RuleStorageScanner;

    /**
     * Constructor.
     *
     * @param lists Rule lists array.
     *
     * @throws Error on duplicate lists.
     */
    constructor(lists: IRuleList[]) {
        this.lists = lists;
        this.listsMap = new Map<number, IRuleList>();
        this.cache = new Map<number, IRule>();

        this.lists.forEach((list) => {
            const filterListId = list.getId();
            if (this.listsMap.get(filterListId)) {
                throw new Error(`Duplicate list ID: ${filterListId}`);
            }

            this.listsMap.set(filterListId, list);
        });
    }

    /**
     * Retrieves a rule node by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule node or `null`.
     */
    public retrieveRuleNode(filterId: number, ruleIndex: number): AnyRule | null {
        if (!this.listsMap.has(filterId)) {
            return null;
        }

        return this.listsMap.get(filterId)!.retrieveRuleNode(ruleIndex);
    }

    /**
     * Creates a new instance of RuleStorageScanner.
     * It can be used to read and parse all the storage contents.
     *
     * @param scannerType The type of scanner to create.
     *
     * @returns Scanner instance.
     */
    public createRuleStorageScanner(scannerType: ScannerType): RuleStorageScanner {
        const scanners: RuleScanner[] = this.lists.map((list) => list.newScanner(scannerType));
        this.scanner = new RuleStorageScanner(scanners);
        return this.scanner;
    }

    /**
     * Looks for the filtering rule in this storage.
     *
     * @param storageIdx The lookup index that you can get from the rule storage scanner.
     * @param ignoreHost Rules could be retrieved as host rules.
     *
     * @returns The rule or null if not found or an error occurs.
     */
    public retrieveRule(storageIdx: number, ignoreHost = true): IRule | null {
        const rule = this.cache.get(storageIdx);
        if (rule) {
            return rule;
        }

        const [listId, ruleId] = this.scanner.getIds(storageIdx);

        const list = this.listsMap.get(listId);

        if (!list) {
            logger.warn(`[tsurl.RuleStorage.retrieveRule]: failed to retrieve list ${listId}, should not happen in normal operation`);

            return null;
        }

        const ruleNode = list.retrieveRuleNode(ruleId);

        if (!ruleNode) {
            logger.warn(`[tsurl.RuleStorage.retrieveRule]: failed to retrieve rule ${ruleId}, should not happen in normal operation`);

            return null;
        }

        const result = RuleFactory.createRule(ruleNode, listId, ruleId, false, false, ignoreHost);

        if (result) {
            this.cache.set(storageIdx, result);
        }

        return result;
    }

    /**
     * Retrieves a network rule from the storage.
     *
     * @param storageIdx Storage index of the rule.
     *
     * @returns The rule or nil in any other case (not found or error).
     */
    public retrieveNetworkRule(storageIdx: number): NetworkRule | null {
        const rule = this.retrieveRule(storageIdx);
        if (!rule) {
            return null;
        }

        if (rule instanceof NetworkRule) {
            return rule as NetworkRule;
        }

        return null;
    }

    /**
     * Retrieves a host rule from the storage.
     *
     * @param storageIdx Storage index of the rule.
     *
     * @returns The rule or nil in any other case (not found or error).
     */
    public retrieveHostRule(storageIdx: number): HostRule | null {
        const rule = this.retrieveRule(storageIdx, false);
        if (!rule) {
            return null;
        }

        if (rule instanceof HostRule) {
            return rule as HostRule;
        }

        return null;
    }

    /**
     * Returns the size of the cache.
     *
     * @returns The size of the cache.
     */
    public getCacheSize(): number {
        return this.cache.size;
    }
}
