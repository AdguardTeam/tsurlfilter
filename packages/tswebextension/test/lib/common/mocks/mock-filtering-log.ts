import {
    FilteringLogEvent,
    FilteringLogInterface,
    EventChannel,
} from '@lib/common';

/**
 * Filtering log mock.
 */
export class MockFilteringLog implements FilteringLogInterface {
    onLogEvent = new EventChannel<FilteringLogEvent>();

    addEventListener = jest.fn();

    publishEvent = jest.fn();
}
