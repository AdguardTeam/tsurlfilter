import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';
import browser from 'sinon-chrome';
import { type NetworkRule } from '@adguard/tsurlfilter';

import { TabsApi } from '../../../../src/lib/mv3/tabs/tabs-api';
import { TabContext } from '../../../../src/lib/mv3/tabs/tab-context';
import { FrameMV3 } from '../../../../src/lib/mv3/tabs/frame';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { Frames } from '../../../../src/lib/common/tabs/frames';
import { type TabInfo } from '../../../../src/lib/common/tabs/tabs-api';

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

            const frame = new FrameMV3({
                url: 'https://example.org',
                tabId,
                frameId,
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
        it('should increment tab context blocked request count', () => {
            const tabId = 1;
            const url = 'https://example.org';

            const tabContext = {
                info: { url },
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            tabsApi.incrementTabBlockedRequestCount(tabId, url);

            expect(tabContextIncrement).toBeCalled();
        });

        it('should not increment tab context blocked request count if origin and referer domains are different', () => {
            const tabId = 1;
            const originUrl = 'https://example.org';
            const referrerUrl = 'https://ref.com';

            const tabContext = {
                info: { url: originUrl },
                incrementBlockedRequestCount: vi.fn(),
            } as unknown as TabContext;
            const tabContextIncrement = vi.spyOn(tabContext, 'incrementBlockedRequestCount');

            tabsApi.context.set(tabId, tabContext);
            tabsApi.incrementTabBlockedRequestCount(tabId, referrerUrl);

            expect(tabContextIncrement).not.toBeCalled();
        });

        it('should not increment tab context blocked request count if tab context is not found', () => {
            tabsApi.incrementTabBlockedRequestCount(1, '');

            expect(TabContext.prototype.incrementBlockedRequestCount).not.toBeCalled();
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
