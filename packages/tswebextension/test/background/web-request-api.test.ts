import { webRequestApi } from '../../src/background/web-request-api';

// TODO
describe('web request api', () => {
    it('start', () => {
        webRequestApi.start();
        expect(true).toBe(true);
    });

    it('stop', () => {
        webRequestApi.stop();
        expect(true).toBe(true);
    });
});
