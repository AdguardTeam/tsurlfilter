import { messagesApi } from '../../src/background/messages-api';

describe('Messages Api', () => {
    it('start', () => {
        messagesApi.start();
        expect(true).toBe(true);
    });

    it('stop', () => {
        messagesApi.stop();
        expect(true).toBe(true);
    });
});
