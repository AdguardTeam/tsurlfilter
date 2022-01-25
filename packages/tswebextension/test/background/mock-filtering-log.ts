import { FilteringLog } from '../../src/background/filtering-log';

export class MockFilteringLog implements FilteringLog {
    addCookieEvent = jest.fn();

    addRemoveHeaderEvent = jest.fn();

    addRemoveParamEvent = jest.fn();

    onHtmlRuleApplied = jest.fn();

    onModificationFinished = jest.fn();

    onModificationStarted = jest.fn();

    onReplaceRulesApplied = jest.fn();

    bindStealthActionsToHttpRequestEvent = jest.fn();
}
