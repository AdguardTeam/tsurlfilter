import { IRuleList } from './rule-list';
import { RuleStorageScanner } from './scanner/rule-storage-scanner';
import { IRule } from '../rules/rule';
import { RuleScanner } from './scanner/rule-scanner';
import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';
import { ScannerType } from './scanner/scanner-type';
import { RuleFactory } from '../rules/rule-factory';
import { ListCache } from './list-cache';
import { logger } from '../utils/logger';

/**
 * RuleStorage is an abstraction that combines several rule lists
 * It can be scanned using RuleStorageScanner, and also it allows
 * retrieving rules by its index

 * The idea is to keep rules in a serialized format (even original format in the case of FileRuleList)
 * and create them in a lazy manner only when we really need them. When the filtering engine is
 * being initialized, we need to scan the rule lists once in order to fill up the lookup tables.
 * We use rule indexes as a unique rule identifier instead of the rule itself.
 * The rule is created (see RetrieveRule) only when there's a chance that it's needed.

 * Rule index is an int64 value that actually consists of two int32 values:
 * One is the rule list identifier, and the second is the index of the rule inside of that list.
*/
export class RuleStorage {
    /**
     * Lists is an array of rules lists which can be accessed using this RuleStorage
     */
    private readonly lists: IRuleList[];

    /**
     * Map with rule lists. map key is the list ID.
     */
    private readonly listsMap: Map<number, IRuleList>;

    /**
     * Cache with the rules which were retrieved.
     * We use double layer map in order to achieve better performance. The reason is a fact that a map with number
     * keys is much faster than a map with string keys. So we have a structure like Map<number, Map<number, IRule>>.
     */
    private readonly cache: Map<number, ListCache>;

    /**
     * Constructor
     *
     * @param lists rule lists array
     *
     * @throws on duplicate lists
     */
    constructor(lists: IRuleList[]) {
        this.lists = lists;
        this.listsMap = new Map<number, IRuleList>();
        this.cache = new Map<number, ListCache>();

        this.lists.forEach((list) => {
            const filterListId = list.getId();
            if (this.listsMap.get(filterListId)) {
                throw new Error(`Duplicate list ID: ${filterListId}`);
            }

            this.listsMap.set(filterListId, list);
        });
    }

    /**
     * Creates a new instance of RuleStorageScanner.
     * It can be used to read and parse all the storage contents.
     *
     * @return scanner instance
     */
    createRuleStorageScanner(scannerType: ScannerType): RuleStorageScanner {
        const scanners: RuleScanner[] = this.lists.map((list) => list.newScanner(scannerType));
        return new RuleStorageScanner(scanners);
    }

    /**
     * Looks for the filtering rule in this storage
     *
     * @param storageIdx the lookup index that you can get from the rule storage scanner
     * @param ignoreHost rules could be retrieved as host rules
     */
    retrieveRule(storageIdx: number, ignoreHost = true): IRule | null {
        const [listId, ruleIdx] = RuleStorageScanner.storageIdxToRuleListIdx(storageIdx);

        const rule = this.getFromCache(listId, ruleIdx);
        if (rule) {
            return rule;
        }

        const list = this.listsMap.get(listId);
        if (!list) {
            logger.warn(`Failed to retrieve list ${listId}, should not happen in normal operation`);

            return null;
        }

        const ruleText = list.retrieveRuleText(ruleIdx);
        if (!ruleText) {
            logger.warn(`Failed to retrieve rule ${ruleIdx}, should not happen in normal operation`);

            return null;
        }

        const result = RuleFactory.createRule(ruleText, listId, false, false, ignoreHost);
        if (result) {
            this.saveToCache(listId, ruleIdx, result);
        }

        return result;
    }

    /**
     * RetrieveNetworkRule is a helper method that retrieves a network rule from the storage
     *
     * @param storageIdx
     * @return the rule or nil in any other case (not found or error)
     */
    retrieveNetworkRule(storageIdx: number): NetworkRule | null {
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
     * RetrieveHostRule is a helper method that retrieves a host rule from the storage
     *
     * @param storageIdx
     * @return the rule or nil in any other case (not found or error)
     */
    retrieveHostRule(storageIdx: number): HostRule | null {
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
     */
    getCacheSize(): number {
        return Array.from(this.cache.values())
            .reduce((acc, listCache) => acc + listCache.getSize(), 0);
    }

    /**
     * Saves rule to cache
     *
     * @param listId
     * @param ruleIdx
     * @param rule
     */
    private saveToCache(listId: number, ruleIdx: number, rule: IRule): void {
        let listCache = this.cache.get(listId);
        if (!listCache) {
            listCache = new ListCache();
            this.cache.set(listId, listCache);
        }
        listCache.set(ruleIdx, rule);
    }

    /**
     * Retrieves rule form cache
     *
     * @param listId
     * @param ruleIdx
     */
    private getFromCache(listId: number, ruleIdx: number): IRule | undefined {
        const listCache = this.cache.get(listId);
        if (!listCache) {
            return undefined;
        }
        return listCache.get(ruleIdx);
    }
}
