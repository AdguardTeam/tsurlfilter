import { FilteringLog } from '../src/filtering-log';

export class MockFilteringLog implements FilteringLog {
    addCookieEvent = jest.fn(() => {
        // Do nothing
    });

    addRemoveHeaderEvent = jest.fn(() => {
        // Do nothing
    });
}
