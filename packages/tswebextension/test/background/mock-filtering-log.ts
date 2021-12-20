import { FilteringLog } from '../../src/background/filtering-log';

export class MockFilteringLog implements FilteringLog {
    addCookieEvent = jest.fn(() => {
        // Do nothing
    });

    addRemoveHeaderEvent = jest.fn(() => {
        // Do nothing
    });

    onHtmlRuleApplied = jest.fn(() => {
        // Do nothing
    });

    onModificationFinished = jest.fn(() => {
        // Do nothing
    });

    onModificationStarted = jest.fn(() => {
        // Do nothing
    });

    onReplaceRulesApplied = jest.fn(() => {
        // Do nothing
    });

    bindStealthActionsToHttpRequestEvent = jest.fn(() => {
        // Do nothing
    });
}
