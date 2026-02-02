import { type FilterList } from './filter-list';
import { StringLineReader } from './reader/string-line-reader';
import { type IRuleList, LIST_ID_MAX_VALUE } from './rule-list';
import { RuleScanner } from './scanner/rule-scanner';
import { type ScannerType } from './scanner/scanner-type';

/**
 * `FilterRuleList` wraps a {@link FilterList} to provide {@link IRuleList} implementation.
 * It allows efficient rule scanning and retrieval from pre-converted filter lists,
 * with support for ignoring cosmetic, JS, and unsafe rules.
 */
export class FilterRuleList implements IRuleList {
    /**
     * Rule list ID.
     */
    private readonly id: number;

    /**
     * {@link FilterList} containing pre-processed filtering rules.
     */
    private readonly list: FilterList;

    /**
     * Whether to ignore cosmetic rules or not.
     */
    private readonly ignoreCosmetic: boolean;

    /**
     * Whether to ignore javascript cosmetic rules or not.
     */
    private readonly ignoreJS: boolean;

    /**
     * Whether to ignore unsafe rules or not.
     */
    public readonly ignoreUnsafe: boolean;

    /**
     * Constructor.
     *
     * @param listId Rule list identifier.
     * @param list {@link FilterList} instance containing pre-processed rules.
     * @param ignoreCosmetic (Optional) default false.
     * @param ignoreJS (Optional) default false.
     * @param ignoreUnsafe (Optional) default false.
     */
    constructor(
        listId: number,
        list: FilterList,
        ignoreCosmetic?: boolean,
        ignoreJS?: boolean,
        ignoreUnsafe?: boolean,
    ) {
        if (listId >= LIST_ID_MAX_VALUE) {
            throw new Error(`Invalid list identifier, it must be less than ${LIST_ID_MAX_VALUE}`);
        }

        this.id = listId;
        this.list = list;
        this.ignoreCosmetic = !!ignoreCosmetic;
        this.ignoreJS = !!ignoreJS;
        this.ignoreUnsafe = !!ignoreUnsafe;
    }

    /**
     * Gets the rule list identifier.
     *
     * @returns The rule list identifier.
     */
    public getId(): number {
        return this.id;
    }

    /**
     * Creates a new rules scanner that reads the list contents.
     *
     * @param scannerType Scanner type.
     *
     * @returns Scanner object.
     */
    public newScanner(scannerType: ScannerType): RuleScanner {
        const reader = new StringLineReader(this.list.getContent());
        return new RuleScanner(reader, this.id, {
            scannerType,
            ignoreCosmetic: this.ignoreCosmetic,
            ignoreJS: this.ignoreJS,
        });
    }

    /**
     * Finds rule text by its index.
     * If there's no rule by that index or rule is invalid, it will return null.
     *
     * @param ruleIdx Rule index.
     *
     * @returns Rule text or null.
     */
    public retrieveRuleText(ruleIdx: number): string | null {
        return this.list.getRuleText(ruleIdx);
    }

    /**
     * Finds original rule text by its index.
     * If there's no rule by that index or rule is invalid, it will return null.
     *
     * @param ruleIdx Rule index.
     *
     * @returns Rule text or null.
     */
    public retrieveOriginalRuleText(ruleIdx: number): string | null {
        return this.list.getConvertedRuleOriginal(ruleIdx);
    }
}
