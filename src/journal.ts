import { Request } from './request';
import { JournalEvent } from './journal-event';
import { NetworkRule } from './rules/network-rule';
import { CosmeticRule } from './rules/cosmetic-rule';

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
     * @param rule
     */
    public recordNetworkRuleEvent(tabId: number, request: Request, rule: NetworkRule): void {
        if (this.listeners.length > 0) {
            const event = new JournalEvent(tabId, rule);

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
     * @param rule
     */
    public recordCosmeticRuleEvent(tabId: number, hostname: string, rule: CosmeticRule): void {
        if (this.listeners.length > 0) {
            const event = new JournalEvent(tabId, rule);

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
