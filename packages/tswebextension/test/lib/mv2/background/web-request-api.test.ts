import { describe, expect, it } from 'vitest';

import { WebRequestApi } from '../../../../src/lib/mv2/background/web-request-api';

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
