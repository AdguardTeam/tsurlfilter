import { RequestType } from '@adguard/tsurlfilter';
import { ContentType } from '@lib/common';
import {
    requestContextStorage,
    RequestContext,
    RequestContextState,
} from '@lib/mv2/background/request/request-context-storage';

describe('Request Context Storage', () => {
    it('supports CRUD operations', () => {
        const requestId = '12345';

        const data: RequestContext = {
            state: RequestContextState.BeforeRequest,
            requestId: '1',
            tabId: 1,
            frameId: 0,
            timestamp: Date.now(),
            requestUrl: 'https://example.org',
            referrerUrl: 'https://example.org',
            requestFrameId: 0,
            requestType: RequestType.Document,
            method: 'GET',
            contentType: ContentType.Document,
            thirdParty: false,
        };

        // Create
        expect(requestContextStorage.record(requestId, data)).toBe(data);

        // Read
        expect(requestContextStorage.get(requestId)).toBe(data);

        // Update
        const update = { requestUrl: 'http://example.org' };

        const updatedData = { ...data, ...update };

        requestContextStorage.update(requestId, update);

        expect(requestContextStorage.get(requestId)).toEqual(updatedData);

        // Delete
        requestContextStorage.delete(requestId);

        expect(requestContextStorage.get(requestId)).toBe(undefined);
    });
});
