import browser from 'sinon-chrome';
import type { ExtensionTypes } from 'webextension-polyfill';
import type {
    CosmeticResult,
    MatchingResult,
    NetworkRule,
} from '@adguard/tsurlfilter';
import { TabFrameRequestContext, TabsApi } from '@lib/mv2/background/tabs/tabs-api';
import { TabContext, TabInfo } from '@lib/mv2/background/tabs/tab-context';
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
jest.mock('@lib/mv2/background/tabs/tab-context');

describe('TabsApi', () => {
    let tabsApi: TabsApi;
    let documentApi: DocumentApi;

    beforeEach(() => {
        const allowlist = new Allowlist();
        const engineApi = new EngineApi(allowlist, appContext, stealthApi);
        documentApi = new DocumentApi(allowlist, engineApi);
        tabsApi = new TabsApi(documentApi);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    const createTestTabContext = (): TabContext => {
        return new TabContext({} as TabInfo, documentApi);
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

            const tabContext = { frames: new Map() } as TabContext;

            const frameId = MAIN_FRAME_ID;

            const frame = new Frame('example.com');

            tabContext.frames.set(frameId, frame);

            tabsApi.context.set(tabId, tabContext);

            expect(tabsApi.getTabFrame(tabId, frameId)).toBe(frame);
            expect(tabsApi.getTabMainFrame(tabId)).toBe(frame);
        });

        it('should return null if tab frame is not found', () => {
            expect(tabsApi.getTabFrame(1, 1)).toBeNull();
        });
    });

    describe('handleFrameRequest method', () => {
        it('should handle frame request for the tab context', () => {
            const tabId = 1;

            const tabContext = createTestTabContext();

            tabsApi.context.set(tabId, tabContext);

            const frameRequestContext = { tabId } as TabFrameRequestContext;

            tabsApi.handleFrameRequest(frameRequestContext);

            expect(TabContext.prototype.handleFrameRequest).toBeCalledWith(frameRequestContext, false);
        });

        it('should not handle frame request if tab context is not found', () => {
            const frameRequestContext = { tabId: 1 } as TabFrameRequestContext;

            tabsApi.handleFrameRequest(frameRequestContext);

            expect(TabContext.prototype.handleFrameRequest).not.toBeCalled();
        });
    });

    describe('handleFrameCosmeticResult method', () => {
        it('should handle cosmetic result for the tab context', () => {
            const tabId = 1;
            const frameId = 1;

            const tabContext = createTestTabContext();

            tabsApi.context.set(tabId, tabContext);

            const cosmeticResult = {} as CosmeticResult;

            tabsApi.handleFrameCosmeticResult(tabId, frameId, cosmeticResult);

            expect(TabContext.prototype.handleFrameCosmeticResult).toBeCalledWith(frameId, cosmeticResult);
        });

        it('should not handle cosmetic result if tab context is not found', () => {
            const cosmeticResult = {} as CosmeticResult;

            tabsApi.handleFrameCosmeticResult(1, 0, cosmeticResult);

            expect(TabContext.prototype.handleFrameCosmeticResult).not.toBeCalled();
        });
    });

    describe('handleFrameMatchingResult method', () => {
        it('should handle matching result for the tab context', () => {
            const tabId = 1;
            const frameId = 1;

            const tabContext = createTestTabContext();

            tabsApi.context.set(tabId, tabContext);

            const matchingResult = {} as MatchingResult;

            tabsApi.handleFrameMatchingResult(tabId, frameId, matchingResult);

            expect(TabContext.prototype.handleFrameMatchingResult).toBeCalledWith(frameId, matchingResult);
        });

        it('should not handle matching result if tab context is not found', () => {
            const matchingResult = {} as MatchingResult;

            tabsApi.handleFrameMatchingResult(1, 0, matchingResult);

            expect(TabContext.prototype.handleFrameMatchingResult).not.toBeCalled();
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
        it('should increment tab context blocked request count', () => {
            const tabId = 1;

            const tabContext = createTestTabContext();

            tabsApi.context.set(tabId, tabContext);

            tabsApi.incrementTabBlockedRequestCount(tabId);

            expect(TabContext.prototype.incrementBlockedRequestCount).toBeCalled();
        });

        it('should not increment tab context blocked request count if tab context is not found', () => {
            tabsApi.incrementTabBlockedRequestCount(1);

            expect(TabContext.prototype.incrementBlockedRequestCount).not.toBeCalled();
        });
    });

    describe('updateTabMainFrameRule method', () => {
        it('should update tab context main frame rule', () => {
            const tabId = 1;

            const tabContext = { info: { url: 'https://example.com' } } as TabContext;

            tabsApi.context.set(tabId, tabContext);

            const mainFrameRule = {} as NetworkRule;

            jest.spyOn(documentApi, 'matchFrame').mockImplementationOnce(() => mainFrameRule);

            tabsApi.updateTabMainFrameRule(tabId);

            expect(tabContext.mainFrameRule).toBe(mainFrameRule);
        });

        it('should not update tab context main frame rule if tab context is not found', () => {
            tabsApi.updateTabMainFrameRule(1);

            expect(documentApi.matchFrame).not.toBeCalled();
        });
    });

    describe('updateCurrentTabsMainFrameRules method', () => {
        it('should update all current tabs main frame rules', async () => {
            const tabId = 1;

            browser.tabs.query.resolves([{ id: tabId } as TabInfo]);

            const spy = jest.spyOn(tabsApi, 'updateTabMainFrameRule').mockImplementation();

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

    describe('static injectScript method', () => {
        it('should inject script to the frame with correct properties', async () => {
            const code = 'console.log("Hello, World!")';
            const tabId = 1;
            const frameId = 1;

            const injectDetails: ExtensionTypes.InjectDetails = {
                code,
                frameId,
                runAt: 'document_start',
                matchAboutBlank: true,
            };

            await TabsApi.injectScript(code, tabId, frameId);

            expect(browser.tabs.executeScript.calledOnceWith(tabId, injectDetails)).toBe(true);
        });
    });

    describe('static injectCss method', () => {
        it('should inject css to the frame with correct properties', async () => {
            const code = 'body { background: red; }';
            const tabId = 1;
            const frameId = 1;

            const injectDetails: ExtensionTypes.InjectDetails = {
                code,
                frameId,
                runAt: 'document_start',
                matchAboutBlank: true,
                cssOrigin: 'user',
            };

            await TabsApi.injectCss(code, tabId, frameId);

            expect(browser.tabs.insertCSS.calledOnceWith(tabId, injectDetails)).toBe(true);
        });
    });
});
