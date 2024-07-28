import { HTTPMethod } from '@adguard/tsurlfilter';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import {
    type RequestContext,
    RequestContextState,
    requestContextStorage,
} from '../../../../../src/lib';
import { ContentType } from '../../../../../src/lib/common/request-type';

describe('Request Context Storage', () => {
    const requestId = '12345';

    const data: RequestContext = {
        eventId: '1',
        state: RequestContextState.BeforeRequest,
        requestId: '1',
        tabId: 1,
        frameId: 0,
        timestamp: Date.now(),
        requestUrl: 'https://example.org',
        referrerUrl: 'https://example.org',
        requestFrameId: 0,
        requestType: RequestType.Document,
        method: HTTPMethod.GET,
        contentType: ContentType.Document,
        thirdParty: false,
    };

    it('should set context to storage', () => {
        expect(requestContextStorage.set(requestId, data)).toBe(requestContextStorage);
    });

    it('should get context from storage', () => {
        expect(requestContextStorage.get(requestId)).toEqual(data);
    });

    it('should partial update context in storage', () => {
        const update = { requestUrl: 'http://another.org' };

        const updatedData = { ...data, ...update };

        requestContextStorage.update(requestId, update);

        const context = requestContextStorage.get(requestId);

        expect(context).toEqual(updatedData);

        // Update keeps record ref
        expect(context).toBe(data);
    });

    it('should delete context from storage', () => {
        expect(requestContextStorage.delete(requestId)).toBe(true);
        expect(requestContextStorage.get(requestId)).toBe(undefined);
    });
});
