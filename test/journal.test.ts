import {
    CosmeticOption, Engine, NetworkRule, Request, RequestType, RuleStorage, StringRuleList,
} from '../src';
import { Journal } from '../src/journal';
import { JournalEvent } from '../src/journal-event';
import { CosmeticRule } from '../src/rules/cosmetic-rule';

describe('TestJournal', () => {
    it('works if journal created and manages rules correctly', () => {
        const journal = new Journal();

        const ruleEventHandler = jest.fn((event: JournalEvent): void => {
            expect(event).toBeTruthy();
            expect(event.request).toBeTruthy();
        });

        journal.on('request', ruleEventHandler);

        const request = new Request('https://example.org', '', RequestType.Document);
        journal.recordNetworkRuleEvent(request, []);
        journal.recordNetworkRuleEvent(request, [new NetworkRule('||example.org^$third-party', 1)]);

        journal.recordCosmeticRuleEvent(request, []);
        journal.recordCosmeticRuleEvent(request, [new CosmeticRule('example.org##cosmetic', 1)]);

        expect(ruleEventHandler).toHaveBeenCalledTimes(4);
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
            expect(event.request).toBeTruthy();
            expect(event.rules).toHaveLength(1);
            expect(event.rules[0].getText()).toBe(networkRule);
        });

        journal.on('request', ruleEventHandler);

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);
        expect(result).toBeTruthy();

        expect(ruleEventHandler).toHaveBeenCalledTimes(1);
    });

    it('works if cosmetic rules are recorded and rule events fired', () => {
        const engine = new Engine(new RuleStorage([list]));
        const journal = engine.getJournal();

        const ruleEventHandler = jest.fn((event: JournalEvent): void => {
            expect(event).toBeTruthy();
            expect(event.request).toBeTruthy();
            expect(event.rules).toHaveLength(1);
            expect(event.rules[0].getText()).toBe(cosmeticRule);
        });

        journal.on('request', ruleEventHandler);

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.getCosmeticResultForRequest(request, CosmeticOption.CosmeticOptionAll);
        expect(result).toBeTruthy();

        expect(ruleEventHandler).toHaveBeenCalledTimes(1);
    });
});
