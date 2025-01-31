import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { TabContext, type TabInfoMV3 } from '../../../../src/lib/mv3/tabs/tab-context';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { FrameMV3 } from '../../../../src/lib/mv3/tabs/frame';
import { MAIN_FRAME_ID } from '../../../../src/lib/common/constants';
import { Frames } from '../../../../src/lib/common/tabs/frames';

vi.mock('../../../../src/lib/mv3/background/engine-api');

describe('TabContext', () => {
    let tabInfo: TabInfoMV3;
    let tabContext: TabContext;

    beforeEach(() => {
        tabInfo = {
            id: 123,
            status: 'complete',
            url: 'https://example.com',
        } as TabInfoMV3;

        tabContext = new TabContext(tabInfo);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create a new TabContext instance with the correct properties', () => {
            expect(tabContext).toBeInstanceOf(TabContext);
            expect(tabContext.frames).toBeInstanceOf(Frames);
            expect(tabContext.blockedRequestCount).toBe(0);
            expect(tabContext.mainFrameRule).toBeNull();
            expect(tabContext.info).toBe(tabInfo);
        });
    });

    describe('incrementBlockedRequestCount method', () => {
        it('should increment blocked request count', () => {
            tabContext.incrementBlockedRequestCount();

            expect(tabContext.blockedRequestCount).toBe(1);
        });
    });

    describe('createNewTabContext static method', () => {
        it('should create a new TabContext instance with the correct properties', () => {
            Object.assign(tabInfo, { pendingUrl: 'https://another.com' });

            const context = TabContext.createNewTabContext(tabInfo);

            expect(engineApi.matchFrame).toBeCalledWith(tabInfo.pendingUrl);
            expect(context.frames.get(MAIN_FRAME_ID)).toEqual(new FrameMV3({
                tabId: tabInfo.id,
                frameId: MAIN_FRAME_ID,
                url: tabInfo.pendingUrl!,
                timeStamp: 0,
            }));
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
