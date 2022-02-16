import { WebRequestApi } from '@lib/mv2/background/web-request-api';

// TODO
describe('web request api', () => {
    it('start', () => {
        WebRequestApi.start();
        expect(true).toBe(true);
    });

    it('stop', () => {
        WebRequestApi.stop();
        expect(true).toBe(true);
    });
});
