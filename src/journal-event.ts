import { IRule } from './rules/rule';

/**
 * Rule journal event
 */
export class JournalEvent {
    /**
     * Tab identifier
     */
    public readonly tabId: number;

    /**
     * Event rule
     */
    public readonly rule: IRule;

    /**
     * Constructor
     *
     * @param tabId
     * @param rule
     */
    constructor(tabId: number, rule: IRule) {
        this.tabId = tabId;
        this.rule = rule;
    }

    /**
     * Rule text
     */
    public getRuleText(): string {
        return this.rule.getText();
    }
}
