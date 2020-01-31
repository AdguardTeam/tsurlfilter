/**
 * RuleList represents a set of filtering rules
 */
import { RuleScanner } from './rule-scanner';
import { IRule } from '../rule';
import { StringLineReader } from './string-line-reader';

/**
 * RuleList represents a set of filtering rules
 */
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
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
     * Constructor
     *
     * @param listId
     * @param ruleText
     * @param ignoreCosmetic
     */
    constructor(listId: number, ruleText: string, ignoreCosmetic: boolean) {
        this.id = listId;
        this.rulesText = ruleText;
        this.ignoreCosmetic = ignoreCosmetic;
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
        return new RuleScanner(reader, this.id, this.ignoreCosmetic);
    }

    /**
     * RetrieveRule finds and deserializes rule by its index.
     * If there's no rule by that index or rule is invalid, it will return an error.
     * @param ruleIdx
     * @return rule object
     */
    retrieveRule(ruleIdx: number): IRule | null {
        if (ruleIdx < 0 || ruleIdx >= this.rulesText.length) {
            return null;
        }

        // TODO: Implement
        return null;
        // endOfLine := strings.IndexByte(l.RulesText[ruleIdx:], '\n')
        // if endOfLine == -1 {
        //     endOfLine = len(l.RulesText)
        // } else {
        //     endOfLine += ruleIdx
        // }
        //
        // line := strings.TrimSpace(l.RulesText[ruleIdx:endOfLine])
        // if len(line) == 0 {
        //     return nil, ErrRuleRetrieval
        // }
        //
        // return rules.NewRule(line, l.ID)
    }
}
