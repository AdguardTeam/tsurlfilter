import {
    CosmeticOption, Engine, NetworkRule, Request, RequestType, RuleStorage, StringRuleList,
} from '../src';
import { Journal } from '../src/journal';
import { JournalEvent } from '../src/journal-event';
import { CosmeticRule } from '../src/rules/cosmetic-rule';

const TAB_ID = 1;

describe('TestJournal', () => {
    it('works if journal created and manages rules correctly', () => {
        const journal = new Journal();

        const ruleEventHandler = jest.fn((event: JournalEvent): void => {
            expect(event).toBeTruthy();
            expect(event.tabId).toBe(TAB_ID);
        });

        journal.on('rule', ruleEventHandler);

        const request = new Request('https://example.org', '', RequestType.Document);
        journal.recordNetworkRuleEvent(TAB_ID, request, new NetworkRule('||example.org^$third-party', 1));

        journal.recordCosmeticRuleEvent(TAB_ID, 'example.org', new CosmeticRule('example.org##cosmetic', 1));

        expect(ruleEventHandler).toHaveBeenCalledTimes(2);
    });
});

describe('TestJournalRecordsOnEngine', () => {
    const networkRule = '||example.org^';
    const cosmeticRule = 'example.org##cosmetic';
    const rules = [networkRule, cosmeticRule];
    const list = new StringRuleList(1, rules.join('\n'), false);


    it('works if network rules are recorded and rule events fired', () => {
        const engine = new Engine(new RuleStorage([list]));
        const journal = engine.getJournal();

        const ruleEventHandler = jest.fn((event: JournalEvent): void => {
            expect(event).toBeTruthy();
            expect(event.tabId).toBe(TAB_ID);
            expect(event.getRuleText()).toBe(networkRule);
        });

        journal.on('rule', ruleEventHandler);

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequestWithTabId(TAB_ID, request);
        expect(result).toBeTruthy();

        expect(ruleEventHandler).toHaveBeenCalledTimes(1);
    });

    it('works if cosmetic rules are recorded and rule events fired', () => {
        const engine = new Engine(new RuleStorage([list]));
        const journal = engine.getJournal();

        const ruleEventHandler = jest.fn((event: JournalEvent): void => {
            expect(event).toBeTruthy();
            expect(event.tabId).toBe(TAB_ID);
            expect(event.getRuleText()).toBe(cosmeticRule);
        });

        journal.on('rule', ruleEventHandler);

        const result = engine.getCosmeticResultWithTabId(TAB_ID, 'example.org', CosmeticOption.CosmeticOptionAll);
        expect(result).toBeTruthy();

        expect(ruleEventHandler).toHaveBeenCalledTimes(1);
    });
});
