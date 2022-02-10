import { FilteringLogEvent, FilteringLogInterface, EventChannel } from '@lib/common';

export class MockFilteringLog implements FilteringLogInterface {
    onLogEvent = new EventChannel<FilteringLogEvent>();

    addCookieEvent = jest.fn();

    addRemoveHeaderEvent = jest.fn();

    addRemoveParamEvent = jest.fn();

    addHtmlRuleApplyEvent = jest.fn();

    addReplaceRuleApplyEvent = jest.fn();

    addContentFilteringStartEvent = jest.fn();

    addContentFilteringFinishEvent = jest.fn();

    addStealthActionEvent = jest.fn();
}
