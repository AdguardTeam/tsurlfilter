import { findNextLineBreakIndex } from '../utils/string-utils';

import { StringLineReader } from './reader/string-line-reader';
import { type IRuleList, LIST_ID_MAX_VALUE } from './rule-list-new';
import { RuleScanner } from './scanner-new/rule-scanner';
import { type ScannerType } from './scanner-new/scanner-type';

/**
 * StringRuleList represents a string-based rule list. Consider it a reference
 * implementation of an IRuleList that shows how to supply a custom storage
 * implementation.
 */
export class StringRuleList implements IRuleList {
    /**
     * Rule list ID.
     */
    private readonly id: number;

    /**
     * String with filtering rules (one per line).
     */
    private readonly rulesText: string;

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
     * @param ruleText String with filtering rules (one per line).
     * @param ignoreCosmetic (Optional) default false.
     * @param ignoreJS (Optional) default false.
     * @param ignoreUnsafe (Optional) default false.
     */
    constructor(
        listId: number,
        ruleText: string,
        ignoreCosmetic?: boolean,
        ignoreJS?: boolean,
        ignoreUnsafe?: boolean,
    ) {
        if (listId >= LIST_ID_MAX_VALUE) {
            throw new Error(`Invalid list identifier, it must be less than ${LIST_ID_MAX_VALUE}`);
        }

        this.id = listId;
        this.rulesText = ruleText;
        this.ignoreCosmetic = !!ignoreCosmetic;
        this.ignoreJS = !!ignoreJS;
        this.ignoreUnsafe = !!ignoreUnsafe;
    }

    /**
     * Close does nothing as here's nothing to close in the StringRuleList.
     */
    // eslint-disable-next-line class-methods-use-this
    public close(): void {
        // Empty
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
        const reader = new StringLineReader(this.rulesText);
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
        if (ruleIdx < 0 || ruleIdx >= this.rulesText.length) {
            return null;
        }

        const [endOfLine] = findNextLineBreakIndex(this.rulesText, ruleIdx);

        // Prevent memory leaks by splitting the string into an array and then joining it back.
        // This ensures the returned string is a completely new copy, rather than a slice referencing the original,
        // which could prevent the original string from being garbage collected.
        const line = this.rulesText.slice(ruleIdx, endOfLine).split('').join('');

        if (!line) {
            return null;
        }

        return line.trim();
    }
}
