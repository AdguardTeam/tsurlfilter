/**
 * Rule journal event
 */
export class JournalEvent {
    /**
     * Tab identifier
     */
    public readonly tabId: number;

    /**
     * Event rule text
     */
    public readonly ruleText: string;

    /**
     * Constructor
     *
     * @param tabId
     * @param ruleText
     */
    constructor(tabId: number, ruleText: string) {
        this.tabId = tabId;
        this.ruleText = ruleText;
    }
}
