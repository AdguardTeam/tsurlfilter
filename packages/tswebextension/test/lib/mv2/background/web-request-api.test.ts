import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { type WebNavigation } from 'webextension-polyfill';

import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { engineApi, tabsApi } from '../../../../src/lib/mv2/background/api';
import { WebRequestApi } from '../../../../src/lib/mv2/background/web-request-api';

vi.mock('../../../../src/lib/mv2/background/api');

describe('web request api', () => {
    it('start', () => {
        WebRequestApi.start();
        expect(true).toBe(true);
    });

    it('stop', () => {
        WebRequestApi.stop();
        expect(true).toBe(true);
    });

    describe('onCommittedOperaHook', () => {
        it('should return early if url is not HTTP or WS request', () => {
            const mockDetails: WebNavigation.OnCommittedDetailsType = {
                tabId: 1,
                frameId: MAIN_FRAME_ID,
                url: 'chrome-extension://abcdef/page.html',
                transitionType: 'link',
                transitionQualifiers: [],
                timeStamp: Date.now(),
            };

            // @ts-ignore - accessing private method for testing
            WebRequestApi.onCommittedOperaHook(mockDetails);

            expect(tabsApi.getTabContext).not.toHaveBeenCalled();
            expect(engineApi.matchRequest).not.toHaveBeenCalled();
        });
    });
});
