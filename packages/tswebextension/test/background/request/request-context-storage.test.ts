import { requestContextStorage, RequestContext } from '../../../src/background/request/request-context-storage';

describe('Request Context Storage', () => {
    it('supports CRUD operations', () => {
        const requestId = '12345';

        const data: RequestContext = {
            requestId: '1',
            tabId: 1,
            frameId: 0,
            timestamp: Date.now(),
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
