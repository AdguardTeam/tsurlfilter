import { RuleParser } from '@adguard/agtree';
import { defaultParserOptions } from '@adguard/agtree/parser';

import { CosmeticRule } from '../rules/cosmetic-rule';
import { HostRule } from '../rules/host-rule';
import { NetworkRule } from '../rules/network-rule';
import { RuleFactory } from '../rules/rule-factory';
import { type IRule } from '../rules/rule-new';
import { logger } from '../utils/logger';

import { type IRuleList } from './rule-list-new';
import { type RuleScanner } from './scanner-new/rule-scanner';
import { RuleStorageScanner } from './scanner-new/rule-storage-scanner';
import { type ScannerType } from './scanner-new/scanner-type';

/**
 * RuleStorage is an abstraction that combines several rule lists.
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
     * Cache with the rules which are stored inside this cache instance.
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
     * Retrieves a rule text by its filter list identifier and rule index.
     *
     * If there's no rule by that index or the rule structure is invalid, it will return null.
     *
     * @param filterId Filter list identifier.
     * @param ruleIndex Rule index.
     *
     * @returns Rule text or `null`.
     */
    public retrieveRuleText(filterId: number, ruleIndex: number): string | null {
        const list = this.listsMap.get(filterId);

        if (!list) {
            return null;
        }

        return list.retrieveRuleText(ruleIndex);
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
     * Retrieves the filter list identifier from the storage index.
     *
     * @param storageIdx Storage index of the rule.
     *
     * @returns The filter list identifier.
     */
    public getFilterListId(storageIdx: number): number {
        return this.scanner.getIds(storageIdx)[0];
    }

    /**
     * Looks for the filtering rule in this storage.
     *
     * @param storageIdx The lookup index that you can get from the rule storage scanner.
     * @param ignoreHost Whether to ignore host rules.
     *
     * @returns The rule or null if not found or an error occurs.
     *
     * @note It returns `null` for rules that are ignored in the rule list.
     */
    public retrieveRule(storageIdx: number, ignoreHost = true): IRule | null {
        const rule = this.cache.get(storageIdx);
        if (rule) {
            return rule;
        }

        const [listId, ruleId] = this.scanner.getIds(storageIdx);

        const list = this.listsMap.get(listId);

        if (!list) {
            logger.warn(`[tsurl.RuleStorage.retrieveRule]: Failed to retrieve list ${listId}, should not happen in normal operation`);

            return null;
        }

        const ruleText = list.retrieveRuleText(ruleId);

        if (!ruleText) {
            logger.warn(`[tsurl.RuleStorage.retrieveRule]: Failed to retrieve rule ${ruleId}, should not happen in normal operation`);

            return null;
        }

        // TODO: Consider improving API: currently we pass ignore host flag to the parser and then to the factory.
        const node = RuleParser.parse(ruleText, {
            ...defaultParserOptions,
            parseHostRules: !ignoreHost,
        });

        const result = RuleFactory.createRule(node, listId, ruleId, false, false, ignoreHost);

        if (list.ignoreUnsafe) {
            if (result instanceof NetworkRule && result.isUnsafe()) {
                return null;
            }

            // TODO: Add support for more rule types, if needed
        }

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

        if (rule instanceof NetworkRule) {
            return rule;
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

        if (rule instanceof HostRule) {
            return rule;
        }

        return null;
    }

    /**
     * Retrieves a cosmetic rule from the storage.
     *
     * @param storageIdx Storage index of the rule.
     *
     * @returns The rule or nil in any other case (not found or error).
     */
    public retrieveCosmeticRule(storageIdx: number): CosmeticRule | null {
        const rule = this.retrieveRule(storageIdx);

        if (rule instanceof CosmeticRule) {
            return rule;
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
