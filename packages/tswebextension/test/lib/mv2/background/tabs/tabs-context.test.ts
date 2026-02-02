import {
    describe,
    expect,
    beforeEach,
    afterEach,
    it,
    vi,
} from 'vitest';

import { FrameMV2 } from '../../../../../src/lib/mv2/background/tabs/frame';
import { TabContext } from '../../../../../src/lib/mv2/background/tabs/tab-context';
import { DocumentApi } from '../../../../../src/lib/mv2/background/document-api';
import { Allowlist } from '../../../../../src/lib/mv2/background/allowlist';
import { EngineApi } from '../../../../../src/lib/mv2/background/engine-api';
import { appContext } from '../../../../../src/lib/mv2/background/app-context';
import { stealthApi } from '../../../../../src/lib/mv2/background/api';
import { MAIN_FRAME_ID, NO_PARENT_FRAME_ID } from '../../../../../src/lib/common/constants';
import { Frames } from '../../../../../src/lib/common/tabs/frames';
import { type TabInfo } from '../../../../../src/lib/common/tabs/tabs-api';

vi.mock('../../../../../src/lib/mv2/background/allowlist');
vi.mock('../../../../../src/lib/mv2/background/engine-api');
vi.mock('../../../../../src/lib/mv2/background/document-api');
vi.mock('../../../../../src/lib/mv2/background/stealth-api');
vi.mock('../../../../../src/lib/mv2/background/app-context');

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
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create a new TabContext instance with the correct properties', () => {
            expect(tabContext).toBeInstanceOf(TabContext);
            expect(tabContext.frames).toBeInstanceOf(Frames);
            expect(tabContext.blockedRequestCount).toBe(0);
            expect(tabContext.mainFrameRule).toBeNull();
            expect(tabContext.info).toBe(tabInfo);
            expect(tabContext.isSyntheticTab).toBe(false);
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

            const context = TabContext.createNewTabContext(tabInfo, documentApi);

            expect(documentApi.matchFrame).toBeCalledWith(tabInfo.pendingUrl);
            expect(context.frames.get(MAIN_FRAME_ID)).toEqual(new FrameMV2({
                tabId: tabInfo.id,
                frameId: MAIN_FRAME_ID,
                parentFrameId: NO_PARENT_FRAME_ID,
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
