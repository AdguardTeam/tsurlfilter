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
     * @param request
     * @param rules
     */
    public recordNetworkRuleEvent(request: Request, rules: NetworkRule[]): void {
        if (this.listeners.length > 0) {
            const event = new JournalEvent(request, rules);

            this.listeners.forEach((l) => {
                l.call(null, event);
            });
        }
    }

    /**
     * Adds cosmetic rule event
     *
     * @param request
     * @param rules
     */
    public recordCosmeticRuleEvent(request: Request, rules: CosmeticRule[]): void {
        if (this.listeners.length > 0) {
            const event = new JournalEvent(request, rules);

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
        if (eventName !== 'request') {
            throw new Error(`Event ${eventName} is not supported`);
        }

        this.listeners.push(eventHandler);
    }
}
