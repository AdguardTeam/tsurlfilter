import { vi } from 'vitest';

import { type FilteringLogEvent, type FilteringLogInterface } from '../../../../src/lib/common/filtering-log';
import { EventChannel } from '../../../../src/lib/common/utils/channels';

/**
 * Filtering log mock.
 */
export class MockFilteringLog implements FilteringLogInterface {
    onLogEvent = new EventChannel<FilteringLogEvent>();

    addEventListener = vi.fn();

    publishEvent = vi.fn();
}
