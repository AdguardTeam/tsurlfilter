import type { CosmeticResult, MatchingResult } from '@adguard/tsurlfilter';
import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { TabContext, type TabInfo } from '@lib/mv2/background/tabs/tab-context';
import { Frame, MAIN_FRAME_ID } from '@lib/mv2/background/tabs/frame';
import { Allowlist } from '@lib/mv2/background/allowlist';
import { EngineApi } from '@lib/mv2/background/engine-api';
import { DocumentApi } from '@lib/mv2/background/document-api';
import { appContext } from '@lib/mv2/background/context';
import { stealthApi } from '@lib/mv2/background/stealth-api';

jest.mock('@lib/mv2/background/allowlist');
jest.mock('@lib/mv2/background/engine-api');
jest.mock('@lib/mv2/background/document-api');
jest.mock('@lib/mv2/background/stealth-api');
jest.mock('@lib/mv2/background/context');

describe('TabContext', () => {
    let tabInfo: TabInfo;
    let tabContext: TabContext;
    let documentApi: DocumentApi;

    beforeEach(() => {
        tabInfo = {
            id: 123,
            status: 'complete',
            url: 'https://example.com',
        } as TabInfo;

        const allowlist = new Allowlist();
        const engineApi = new EngineApi(allowlist, appContext, stealthApi);
        documentApi = new DocumentApi(allowlist, engineApi);

        tabContext = new TabContext(tabInfo, documentApi);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create a new TabContext instance with the correct properties', () => {
            expect(tabContext).toBeInstanceOf(TabContext);
            expect(tabContext.frames).toBeInstanceOf(Map);
            expect(tabContext.blockedRequestCount).toBe(0);
            expect(tabContext.mainFrameRule).toBeNull();
            expect(tabContext.info).toBe(tabInfo);
            expect(tabContext.isSyntheticTab).toBe(true);
        });
    });

    describe('updateTabInfo method', () => {
        it('should update tab info with the correct properties', () => {
            const changeInfo = {
                url: 'https://another.com',
                status: 'loading',
            };

            const expectedInfo = { ...tabInfo, ...changeInfo };

            tabContext.updateTabInfo(changeInfo);

            expect(tabContext.info).toEqual(expectedInfo);
            expect(tabContext.info).toBe(tabInfo);
            expect(tabContext.isSyntheticTab).toBe(false);
        });

        it('should handle cached document page initialization on tab update', () => {
            const changeInfo = {
                url: 'https://another.com',
                status: 'loading',
            };

            tabContext.updateTabInfo(changeInfo);

            expect(tabContext.isDocumentRequestCached).toBe(true);
            expect(documentApi.matchFrame).toBeCalledWith(changeInfo.url);
        });

        it('should handle cached document page relaod on tab update', () => {
            const changeInfo = { status: 'loading' };

            tabContext.isDocumentRequestCached = true;
            tabContext.updateTabInfo(changeInfo);

            expect(documentApi.matchFrame).toBeCalledWith(tabInfo.url);
        });
    });

    describe('incrementBlockedRequestCount method', () => {
        it('should increment blocked request count', () => {
            tabContext.incrementBlockedRequestCount();

            expect(tabContext.blockedRequestCount).toBe(1);
        });
    });

    describe('handleFrameRequest method', () => {
        it('should handle document request', () => {
            const frameId = 0;

            const frameRequestContext = {
                frameId,
                requestId: '1',
                requestUrl: 'https://example.com',
                requestType: RequestType.Document,
            };

            tabContext.handleFrameRequest(frameRequestContext);

            expect(documentApi.matchFrame).toBeCalledWith(frameRequestContext.requestUrl);
            expect(tabContext.frames.get(frameRequestContext.frameId)).toEqual(
                new Frame(
                    frameRequestContext.requestUrl,
                    frameRequestContext.requestId,
                ),
            );
        });

        it('should handle subdocument request', () => {
            const frameRequestContext = {
                frameId: 1,
                requestId: '1',
                requestUrl: 'https://example.com',
                requestType: RequestType.SubDocument,
            };

            tabContext.handleFrameRequest(frameRequestContext);

            expect(documentApi.matchFrame).not.toBeCalledWith(frameRequestContext.requestUrl);
            expect(tabContext.frames.get(frameRequestContext.frameId)).toEqual(
                new Frame(
                    frameRequestContext.requestUrl,
                    frameRequestContext.requestId,
                ),
            );
        });
    });

    describe('handleFrameMatchingResult method', () => {
        it('should handle matching result for frame', () => {
            const frameId = 0;

            const frame = new Frame(tabInfo.url!);

            tabContext.frames.set(frameId, frame);

            const matchingResult = {} as MatchingResult;

            tabContext.handleFrameMatchingResult(frameId, matchingResult);

            expect(frame.matchingResult).toBe(matchingResult);
        });
    });

    describe('handleFrameCosmeticResult method', () => {
        it('should handle cosmetic result for frame', () => {
            const frameId = 0;

            const frame = new Frame(tabInfo.url!);

            tabContext.frames.set(frameId, frame);

            const cosmeticResult = {} as CosmeticResult;

            tabContext.handleFrameCosmeticResult(frameId, cosmeticResult);

            expect(frame.cosmeticResult).toBe(cosmeticResult);
        });
    });

    describe('createNewTabContext static method', () => {
        it('should create a new TabContext instance with the correct properties', () => {
            Object.assign(tabInfo, { pendingUrl: 'https://another.com' });

            const context = TabContext.createNewTabContext(tabInfo, documentApi);

            expect(documentApi.matchFrame).toBeCalledWith(tabInfo.pendingUrl);
            expect(context.frames.get(MAIN_FRAME_ID)).toEqual(new Frame(tabInfo.pendingUrl!));
        });
    });

    describe('isBrowserTab static method', () => {
        it('should return true if tab is browser tab', () => {
            expect(TabContext.isBrowserTab(tabInfo)).toBe(true);
        });

        it('should return false if tab is not browser tab', () => {
            tabInfo.id = -1;

            expect(TabContext.isBrowserTab(tabInfo)).toBe(false);
        });
    });
});
