import { Request } from './request';
import { JournalEvent } from './journal-event';

/**
 * Rule triggering journal class
 */
export class Journal {
    /**
     * Listeners array
     */
    private readonly listeners: ((event: JournalEvent) => void)[] = [];

    /**
     * Adds network rule event
     *
     * @param tabId
     * @param request
     * @param ruleText
     */
    public recordNetworkRuleEvent(tabId: number, request: Request, ruleText: string): void {
        if (this.listeners.length > 0) {
            const event = new JournalEvent(tabId, ruleText);

            this.listeners.forEach((l) => {
                l.call(null, event);
            });
        }
    }

    /**
     * Adds cosmetic rule event
     *
     * @param tabId
     * @param hostname
     * @param ruleText
     */
    public recordCosmeticRuleEvent(tabId: number, hostname: string, ruleText: string): void {
        if (this.listeners.length > 0) {
            const event = new JournalEvent(tabId, ruleText);

            this.listeners.forEach((l) => {
                l.call(null, event);
            });
        }
    }

    /**
     * Adds event handler
     *
     * @param eventName
     * @param eventHandler
     */
    public on(eventName: string, eventHandler: (event: JournalEvent) => void): void {
        if (eventName !== 'rule') {
            throw new Error(`Event ${eventName} is not supported`);
        }

        this.listeners.push(eventHandler);
    }
}
