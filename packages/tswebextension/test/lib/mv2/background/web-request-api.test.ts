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
import { CosmeticApi } from '../../../../src/lib/mv2/background/cosmetic-api';
import { type RequestContext } from '../../../../src/lib/mv2/background/request/request-context-storage';
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

    describe('canvas protection', () => {
        beforeEach(() => {
            vi.mocked(canvasInjection.inject).mockClear();
        });

        it('does not inject canvas protection when a document response starts', () => {
            const applyJs = vi.spyOn(CosmeticApi, 'applyJs').mockResolvedValue(undefined);

            [MAIN_FRAME_ID, 2].forEach((frameId) => {
                // @ts-ignore - accessing private method for testing
                WebRequestApi.onResponseStarted({
                    context: {
                        tabId: 1,
                        frameId,
                        requestType: frameId === MAIN_FRAME_ID ? RequestType.Document : RequestType.SubDocument,
                        requestUrl: 'https://example.org/',
                    } as RequestContext,
                });
            });

            expect(canvasInjection.inject).not.toHaveBeenCalled();
            expect(applyJs).toHaveBeenCalledTimes(2);
            expect(applyJs).toHaveBeenNthCalledWith(1, 1, MAIN_FRAME_ID);
            expect(applyJs).toHaveBeenNthCalledWith(2, 1, 2);

            applyJs.mockRestore();
        });

        it('injects canvas protection when a document commits', () => {
            // @ts-ignore - accessing private method for testing
            WebRequestApi.onCommitted({
                tabId: 1,
                frameId: 2,
                url: 'https://example.org/',
                transitionType: 'link',
                transitionQualifiers: [],
                timeStamp: Date.now(),
                documentId: 'document-id',
            });

            expect(canvasInjection.inject).toHaveBeenCalledExactlyOnceWith(1, 2, 'https://example.org/');
        });
    });
});
