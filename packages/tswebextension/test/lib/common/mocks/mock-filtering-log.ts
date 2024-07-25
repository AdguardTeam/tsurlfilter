import { EventChannel, type FilteringLogEvent, type FilteringLogInterface } from '../../../../src/lib';

/**
 * Filtering log mock.
 */
export class MockFilteringLog implements FilteringLogInterface {
    onLogEvent = new EventChannel<FilteringLogEvent>();

    addEventListener = jest.fn();

    publishEvent = jest.fn();
}
