import { IRuleList } from './rule-list';
import { RuleStorageScanner } from './scanner/rule-storage-scanner';
import { IRule } from '../rules/rule';
import { RuleScanner } from './scanner/rule-scanner';
import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';

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
     * cache with the rules which were retrieved.
     */
    private readonly cache: Map<bigint, IRule>;

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
        this.cache = new Map<bigint, IRule>();

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
    createRuleStorageScanner(): RuleStorageScanner {
        const scanners: RuleScanner[] = this.lists.map((list) => list.newScanner());
        return new RuleStorageScanner(scanners);
    }

    /**
     * Looks for the filtering rule in this storage
     *
     * @param storageIdx the lookup index that you can get from the rule storage scanner
     */
    retrieveRule(storageIdx: bigint): IRule | null {
        const rule = this.cache.get(storageIdx);
        if (rule) {
            return rule;
        }

        const [listId, ruleIdx] = RuleStorageScanner.storageIdxToRuleListIdx(storageIdx);

        const list = this.listsMap.get(listId);
        if (!list) {
            // List doesn't exist
            return null;
        }

        const result = list.retrieveRule(ruleIdx);
        if (result) {
            this.cache.set(storageIdx, result);
        }

        return result;
    }

    /**
     * RetrieveNetworkRule is a helper method that retrieves a network rule from the storage
     *
     * @param storageIdx
     * @return the rule or nil in any other case (not found or error)
     */
    retrieveNetworkRule(storageIdx: bigint): NetworkRule | null {
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
    retrieveHostRule(storageIdx: bigint): HostRule | null {
        const rule = this.retrieveRule(storageIdx);
        if (!rule) {
            return null;
        }

        if (rule instanceof HostRule) {
            return rule as HostRule;
        }

        return null;
    }
}
