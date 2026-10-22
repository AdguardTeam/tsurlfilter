import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { type WebNavigation } from 'webextension-polyfill';

import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { canvasInjection, engineApi, tabsApi } from '../../../../src/lib/mv2/background/api';
import { type RequestContext } from '../../../../src/lib/mv2/background/request/request-context-storage';
import { type TabContext } from '../../../../src/lib/mv2/background/tabs/tab-context';
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
                documentId: 'document-id',
            };

            // @ts-ignore - accessing private method for testing
            WebRequestApi.onCommittedOperaHook(mockDetails);

            expect(tabsApi.getTabContext).not.toHaveBeenCalled();
            expect(engineApi.matchRequest).not.toHaveBeenCalled();
        });
    });

    describe('onResponseStarted', () => {
        /**
         * Starts a document response in a tab whose current document has the given URL.
         *
         * @param frameId Frame ID.
         * @param tabUrl URL of the document the tab currently shows.
         */
        const startResponse = (frameId: number, tabUrl: string): void => {
            vi.mocked(tabsApi.getTabContext).mockReturnValue({ info: { url: tabUrl } } as TabContext);
            // @ts-ignore - accessing private method for testing
            WebRequestApi.onResponseStarted({
                context: {
                    tabId: 1,
                    frameId,
                    requestType: frameId === MAIN_FRAME_ID ? RequestType.Document : RequestType.SubDocument,
                    requestUrl: 'https://example.org/',
                } as RequestContext,
            });
        };

        beforeEach(() => {
            vi.mocked(canvasInjection.inject).mockClear();
        });

        it.each([
            'chrome://newtab/',
            'edge://newtab/',
            'about:blank',
            'view-source:https://example.org/',
            'chrome-extension://abcdef/page.html',
        ])('does not inject canvas protection into the main frame showing %s', (tabUrl) => {
            startResponse(MAIN_FRAME_ID, tabUrl);
            expect(canvasInjection.inject).not.toHaveBeenCalled();
        });

        it('injects canvas protection into the main frame showing a web page', () => {
            startResponse(MAIN_FRAME_ID, 'https://example.com/');
            expect(canvasInjection.inject).toHaveBeenCalledExactlyOnceWith(1, MAIN_FRAME_ID, 'https://example.org/');
        });

        it('injects canvas protection into subframes', () => {
            startResponse(2, 'chrome://newtab/');
            expect(canvasInjection.inject).toHaveBeenCalledExactlyOnceWith(1, 2, 'https://example.org/');
        });
    });
});
