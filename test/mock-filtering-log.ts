import { FilteringLog } from '../src/filtering-log';

export class MockFilteringLog implements FilteringLog {
    addHtmlEvent = jest.fn(() => {
        // Do nothing
    });

    addReplaceRulesEvent = jest.fn(() => {
        // Do nothing
    });

    addCookieEvent = jest.fn(() => {
        // Do nothing
    });
}
