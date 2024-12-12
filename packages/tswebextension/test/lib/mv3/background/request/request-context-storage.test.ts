import { RequestType } from '@adguard/tsurlfilter';

import {
    type RequestContext,
    RequestContextState,
    RequestContextStorage,
} from '../../../../../src/lib/mv3/background/request';

describe('RequestContextStorage', () => {
    let storage: RequestContextStorage;
    let mockRequestContext: RequestContext;

    beforeEach(() => {
        storage = new RequestContextStorage();
        mockRequestContext = {
            tabId: 1,
            frameId: 1,
            timestamp: Date.now(),
            requestType: RequestType.Document,
            requestUrl: 'https://example.com',
        } as RequestContext;
    });

    test('should set and get request context', () => {
        storage.set('requestId1', mockRequestContext);
        const context = storage.get('requestId1');
        expect(context).toEqual(mockRequestContext);
    });

    test('should update request context', () => {
        storage.set('requestId2', mockRequestContext);
        const updatedData = { state: RequestContextState.HeadersReceived };
        const updatedContext = storage.update('requestId2', updatedData);
        expect(updatedContext!.state).toBe(RequestContextState.HeadersReceived);
    });

    test('should remove non document/subdocument request context by request id', () => {
        mockRequestContext.requestType = RequestType.Image;
        storage.set('requestId3', mockRequestContext);
        storage.delete('requestId3');
        const context = storage.get('requestId3');
        expect(context).toBeUndefined();
    });

    test('should not remove non expired request context by tab and frame id', () => {
        storage.set('requestId4', mockRequestContext);
        storage.delete(mockRequestContext.requestId);
        const context = storage.get('requestId4');
        expect(context).toBe(mockRequestContext);
    });

    test('should clear all request contexts', () => {
        storage.set('requestId6', mockRequestContext);
        storage.clear();
        const context = storage.get('requestId6');
        expect(context).toBeUndefined();
    });
});
