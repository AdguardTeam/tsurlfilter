import { messagesApi } from '@lib/mv2/background/messages-api';

// TODO
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
