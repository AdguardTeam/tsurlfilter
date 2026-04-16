import browser from 'sinon-chrome';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type NetworkRule } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID, NO_PARENT_FRAME_ID } from '../../../../src/lib/common/constants';
import { Frames } from '../../../../src/lib/common/tabs/frames';
import { type TabInfo } from '../../../../src/lib/common/tabs/tabs-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { FrameMV3 } from '../../../../src/lib/mv3/tabs/frame';
import { TabContext } from '../../../../src/lib/mv3/tabs/tab-context';
import { TabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';

vi.mock('../../../../src/lib/mv3/tabs/tab-context');
vi.mock('../../../../src/lib/mv3/tabs/frame');
vi.mock('../../../../src/lib/mv3/background/engine-api');

describe('TabsApi', () => {
    let tabsApi: TabsApi;

    beforeEach(() => {
        tabsApi = new TabsApi();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    const createTestTabContext = (): TabContext => {
        return new TabContext({} as TabInfo);
    };

    describe('start method', () => {
        it('should start listening for tab & window events', async () => {
            await tabsApi.start();

            expect(browser.tabs.onCreated.addListener.calledOnce).toBe(true);
            expect(browser.tabs.onRemoved.addListener.calledOnce).toBe(true);
            expect(browser.tabs.onUpdated.addListener.calledOnce).toBe(true);
            expect(browser.tabs.onActivated.addListener.calledOnce).toBe(true);
            expect(browser.windows.onFocusChanged.addListener.calledOnce).toBe(true);
        });
    });

    describe('stop method', () => {
        it('should stop listening for tab & window events', () => {
            tabsApi.stop();

            expect(browser.tabs.onCreated.removeListener.calledOnce).toBe(true);
            expect(browser.tabs.onRemoved.removeListener.calledOnce).toBe(true);
            expect(browser.tabs.onUpdated.removeListener.calledOnce).toBe(true);
            expect(browser.tabs.onActivated.removeListener.calledOnce).toBe(true);
            expect(browser.windows.onFocusChanged.removeListener.calledOnce).toBe(true);
        });
    });

    describe('getTabFrameRule method', () => {
        it('should return frame rule for the tab context', () => {
            const tabId = 1;

            const mainFrameRule = {} as NetworkRule;
            const tabContext = { mainFrameRule } as TabContext;

            tabsApi.context.set(tabId, tabContext);

            expect(tabsApi.getTabFrameRule(tabId)).toBe(mainFrameRule);
        });

        it('should return null if tab context is not found', () => {
            expect(tabsApi.getTabFrameRule(1)).toBeNull();
        });
    });

    describe('getTabFrame and getTabMainFrame methods', () => {
        it('should return frame for the tab context', () => {
            const tabId = 1;

            const tabContext = { frames: new Frames() } as TabContext;

            const frameId = MAIN_FRAME_ID;
            const parentFrameId = NO_PARENT_FRAME_ID;

            const frame = new FrameMV3({
                url: 'https://example.org',
                tabId,
                frameId,
                parentFrameId,
                timeStamp: 0,
            });

            tabContext.frames.set(frameId, frame);

            tabsApi.context.set(tabId, tabContext);

            expect(tabsApi.getTabFrame(tabId, frameId)).toBe(frame);
            expect(tabsApi.getTabMainFrame(tabId)).toBe(frame);
        });

        it('should return null if tab frame is not found', () => {
            expect(tabsApi.getTabFrame(1, 1)).toBeNull();
        });
    });

    describe('getTabContext method', () => {
        it('should return tab context by tab id', () => {
            const tabId = 1;

            const tabContext = createTestTabContext();

            tabsApi.context.set(tabId, tabContext);

            expect(tabsApi.getTabContext(tabId)).toBe(tabContext);
        });

        it('should return undefined if tab context is not found', () => {
            expect(tabsApi.getTabContext(1)).toBeUndefined();
        });
    });

    describe('isIncognitoTab method', () => {
        it.each([true, false])('should return correct tab incognito mode: %p', (incognito) => {
            const tabId = 1;

            const tabContext = { info: { incognito } } as TabContext;

            tabContext.info.incognito = true;

            tabsApi.context.set(tabId, tabContext);

            expect(tabsApi.isIncognitoTab(tabId)).toBe(true);
        });

        it('should return false if tab context is not found', () => {
            expect(tabsApi.isIncognitoTab(1)).toBe(false);
        });
    });

    describe('incrementTabBlockedRequestCount method', () => {
        it('should increment count for same-domain request', () => {
            const tabId = 1;
            const url = 'https://example.org';

            const frames = new Frames<FrameMV3>();
            frames.set(MAIN_FRAME_ID, { url } as FrameMV3);
            const tabContext = {
                info: { url },
                frames,
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            tabsApi.incrementTabBlockedRequestCount({
                tabId,
                referrerUrl: url,
            });

            expect(tabContextIncrement).toBeCalled();
        });

        it('should not increment count if domains differ and frame is unknown', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ref.com';

            const frames = new Frames<FrameMV3>();
            frames.set(
                MAIN_FRAME_ID,
                {
                    documentId: 'main-doc',
                } as FrameMV3,
            );

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
                getFrameContextByDocumentId: vi.fn().mockReturnValue(undefined),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            tabsApi.incrementTabBlockedRequestCount({ tabId, referrerUrl });

            expect(tabContextIncrement).not.toBeCalled();
        });

        it('should increment count for cross-domain iframe with parentDocumentId matching main frame (Chrome)', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ads.thirdparty.com';
            const mainDocId = 'MAIN-DOC';

            const frames = new Frames<FrameMV3>();
            frames.set(
                MAIN_FRAME_ID,
                {
                    documentId: mainDocId,
                } as FrameMV3,
            );

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
                getFrameContextByDocumentId: vi.fn().mockReturnValue(undefined),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // parentDocumentId points directly to main frame
            tabsApi.incrementTabBlockedRequestCount({ tabId, referrerUrl, parentDocumentId: mainDocId });

            expect(tabContextIncrement).toBeCalled();
        });

        it('should increment count for nested iframe chain leading to main frame (Chrome)', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ads.thirdparty.com';
            const mainDocId = 'MAIN-DOC';
            const iframe1DocId = 'IFRAME1-DOC';
            const iframe2DocId = 'IFRAME2-DOC';

            const frames = new Frames<FrameMV3>();
            frames.set(MAIN_FRAME_ID, { documentId: mainDocId } as FrameMV3);

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
                getFrameContextByDocumentId: vi.fn().mockImplementation((docId: string) => {
                    if (docId === iframe2DocId) {
                        return { parentDocumentId: iframe1DocId } as FrameMV3;
                    }
                    if (docId === iframe1DocId) {
                        return { parentDocumentId: mainDocId } as FrameMV3;
                    }
                    return undefined;
                }),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // parentDocumentId of the request points to iframe2, which chains to iframe1, then to main
            tabsApi.incrementTabBlockedRequestCount({ tabId, referrerUrl, parentDocumentId: iframe2DocId });

            expect(tabContextIncrement).toBeCalled();
        });

        it('should not increment count when parentDocumentId chain does not reach main frame (Chrome)', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ads.thirdparty.com';

            const frames = new Frames<FrameMV3>();
            frames.set(MAIN_FRAME_ID, { documentId: 'MAIN-DOC' } as FrameMV3);

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
                getFrameContextByDocumentId: vi.fn().mockReturnValue(undefined),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // parentDocumentId points to unknown document — not in current page
            tabsApi.incrementTabBlockedRequestCount({ tabId, referrerUrl, parentDocumentId: 'UNKNOWN-DOC' });

            expect(tabContextIncrement).not.toBeCalled();
        });

        it('should increment count for cross-domain iframe with matching frameAncestors (Firefox)', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ads.thirdparty.com';

            const frames = new Frames<FrameMV3>();
            frames.set(
                MAIN_FRAME_ID,
                {
                    url: originUrl,
                    documentId: 'MAIN-DOC',
                } as FrameMV3,
            );

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // No parentDocumentId — Firefox fallback: top ancestor domain matches tab URL
            tabsApi.incrementTabBlockedRequestCount({
                tabId,
                referrerUrl,
                frameAncestors: [
                    { url: 'https://ads.thirdparty.com/iframe.html', frameId: 5 },
                    { url: 'https://example.org', frameId: 0 },
                ],
            });

            expect(tabContextIncrement).toBeCalled();
        });

        it('should not increment count when frameAncestors top URL does not match (Firefox)', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ads.thirdparty.com';

            const frames = new Frames<FrameMV3>();
            frames.set(
                MAIN_FRAME_ID,
                {
                    documentId: 'MAIN-DOC',
                } as FrameMV3,
            );

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // Top ancestor is from a different page — stale request
            tabsApi.incrementTabBlockedRequestCount({
                tabId,
                referrerUrl,
                frameAncestors: [
                    { url: 'https://ads.thirdparty.com/iframe.html', frameId: 5 },
                    { url: 'https://old-page.com', frameId: 0 },
                ],
            });

            expect(tabContextIncrement).not.toBeCalled();
        });

        it('should not increment count without parentDocumentId or frameAncestors', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ads.thirdparty.com';

            const frames = new Frames<FrameMV3>();
            frames.set(
                MAIN_FRAME_ID,
                {
                    documentId: 'MAIN-DOC',
                } as FrameMV3,
            );

            const tabContext = {
                info: { url: originUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // Neither parentDocumentId nor frameAncestors
            tabsApi.incrementTabBlockedRequestCount({
                tabId,
                referrerUrl,
            });

            expect(tabContextIncrement).not.toBeCalled();
        });

        it('should not increment count if tab context is not found', () => {
            tabsApi.incrementTabBlockedRequestCount({
                tabId: 1,
                referrerUrl: '',
            });

            expect(TabContext.prototype.incrementBlockedRequestCount).not.toBeCalled();
        });

        it('should not leak count when mainFrame.url already changed but tabContext.info.url is stale', () => {
            const tabId = 1;
            // Simulate navigation: amazon.com -> example.org
            // mainFrame.url is already updated to example.org (via onBeforeRequest),
            // but tabContext.info.url still has the old amazon.com (tabs.onUpdated not yet fired).
            const staleTabInfoUrl = 'https://amazon.com';
            const newMainFrameUrl = 'https://example.org';
            const staleReferrerUrl = 'https://amazon.com';

            const frames = new Frames<FrameMV3>();
            frames.set(MAIN_FRAME_ID, { url: newMainFrameUrl } as FrameMV3);

            const tabContext = {
                info: { url: staleTabInfoUrl },
                frames,
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            // Stale request from old page should NOT be counted
            tabsApi.incrementTabBlockedRequestCount({ tabId, referrerUrl: staleReferrerUrl });

            expect(tabContextIncrement).not.toBeCalled();
        });
    });

    describe('updateTabMainFrameRule method', () => {
        it('should update tab context main frame rule', () => {
            const tabId = 1;

            const tabContext = { info: { url: 'https://example.com' } } as TabContext;

            tabsApi.context.set(tabId, tabContext);

            const mainFrameRule = {} as NetworkRule;

            vi.spyOn(engineApi, 'matchFrame').mockImplementationOnce(() => mainFrameRule);

            tabsApi.updateTabMainFrameRule(tabId);

            expect(tabContext.mainFrameRule).toBe(mainFrameRule);
        });

        it('should not update tab context main frame rule if tab context is not found', () => {
            tabsApi.updateTabMainFrameRule(1);

            expect(engineApi.matchFrame).not.toBeCalled();
        });
    });

    describe('updateCurrentTabsMainFrameRules method', () => {
        it('should update all current tabs main frame rules', async () => {
            const tabId = 1;

            browser.tabs.query.resolves([{ id: tabId } as TabInfo]);

            const spy = vi.spyOn(tabsApi, 'updateTabMainFrameRule');

            await tabsApi.updateCurrentTabsMainFrameRules();

            expect(spy).toBeCalledWith(tabId);
        });
    });

    describe('isNewPopupTab method', () => {
        const cases = [
            { url: 'about:blank', expected: true },
            { url: '', expected: true },
            { url: undefined, expected: true },
            { url: 'https://example.com', expected: false },
        ];
        it.each(cases)('should return $expected if tab has url $url', ({ url, expected }) => {
            const tabId = 1;

            const tabContext = { info: { url } } as TabContext;

            tabsApi.context.set(tabId, tabContext);

            expect(tabsApi.isNewPopupTab(tabId)).toBe(expected);
        });
    });
});
