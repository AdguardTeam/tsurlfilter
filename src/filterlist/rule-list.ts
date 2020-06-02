import { RuleScanner } from './scanner/rule-scanner';
import { IRule } from '../rules/rule';
import { StringLineReader } from './reader/string-line-reader';
import { RuleUtils } from '../rules/rule-utils';

/**
 * RuleList represents a set of filtering rules
 */
export interface IRuleList {
    /**
     * GetID returns the rule list identifier
     */
    getId(): number;

    /**
     * Creates a new scanner that reads the list contents
     */
    newScanner(): RuleScanner;

    /**
     * Retrieves a rule by its index
     *
     * @param ruleIdx
     */
    retrieveRule(ruleIdx: number): IRule | null;

    /**
     * Closes the rules list
     */
    close(): void;
}

/**
 * StringRuleList represents a string-based rule list
 */
export class StringRuleList implements IRuleList {
    /**
     * Rule list ID
     */
    private readonly id: number;

    /**
     * String with filtering rules (one per line)
     */
    private readonly rulesText: string;

    /**
     * Whether to ignore cosmetic rules or not
     */
    private readonly ignoreCosmetic: boolean;

    /**
     * Whether to ignore javascript cosmetic rules or not
     */
    private readonly ignoreJS: boolean;


    /**
     * Constructor
     *
     * @param listId
     * @param ruleText
     * @param ignoreCosmetic (Optional) default false
     * @param ignoreJS (Optional) default false
     */
    constructor(listId: number, ruleText: string, ignoreCosmetic?: boolean, ignoreJS?: boolean) {
        this.id = listId;
        this.rulesText = ruleText;
        this.ignoreCosmetic = !!ignoreCosmetic;
        this.ignoreJS = !!ignoreJS;
    }

    /**
     * Close does nothing as here's nothing to close in the StringRuleList
     */
    // eslint-disable-next-line class-methods-use-this
    public close(): void {
        // Empty
    }

    /**
     * @return the rule list identifier
     */
    getId(): number {
        return this.id;
    }

    /**
     * Creates a new rules scanner that reads the list contents
     * @return scanner object
     */
    newScanner(): RuleScanner {
        const reader = new StringLineReader(this.rulesText);
        return new RuleScanner(reader, this.id, this.ignoreCosmetic, this.ignoreJS);
    }

    /**
     * RetrieveRule finds and deserializes rule by its index.
     * If there's no rule by that index or rule is invalid, it will return null
     *
     * @param ruleIdx
     * @return rule object
     */
    retrieveRule(ruleIdx: number): IRule | null {
        if (ruleIdx < 0 || ruleIdx >= this.rulesText.length) {
            return null;
        }

        let endOfLine = this.rulesText.indexOf('\n', ruleIdx);
        if (endOfLine === -1) {
            endOfLine = this.rulesText.length;
        }

        const line = this.rulesText.substring(ruleIdx, endOfLine).trim();
        if (!line) {
            return null;
        }

        return RuleUtils.createRule(line, this.id);
    }
}
