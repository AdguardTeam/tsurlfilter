import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { MAIN_FRAME_ID, NO_PARENT_FRAME_ID } from '../../../../src/lib/common/constants';
import { Frames } from '../../../../src/lib/common/tabs/frames';
import { type TabInfo } from '../../../../src/lib/common/tabs/tabs-api';
import { engineApi } from '../../../../src/lib/mv3/background/engine-api';
import { FrameMV3 } from '../../../../src/lib/mv3/tabs/frame';
import { TabContext } from '../../../../src/lib/mv3/tabs/tab-context';

vi.mock('../../../../src/lib/mv3/background/engine-api');

describe('TabContext', () => {
    let tabInfo: TabInfo;
    let tabContext: TabContext;

    beforeEach(() => {
        tabInfo = {
            id: 123,
            status: 'complete',
            url: 'https://example.com',
        } as TabInfo;

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

    describe('setDocumentId method', () => {
        it('should remove stale document IDs when main frame navigates to a new document', () => {
            const mainFrame = new FrameMV3({
                tabId: tabInfo.id,
                frameId: MAIN_FRAME_ID,
                parentFrameId: NO_PARENT_FRAME_ID,
                url: tabInfo.url!,
                timeStamp: Date.now(),
                documentId: 'doc-1',
            });

            tabContext.setFrameContext(MAIN_FRAME_ID, mainFrame);
            tabContext.setDocumentId('doc-1', MAIN_FRAME_ID);

            mainFrame.documentId = 'doc-2';
            tabContext.setDocumentId('doc-2', MAIN_FRAME_ID);

            expect(tabContext.documentIdsMap.size).toBe(1);
            expect(tabContext.documentIdsMap.get('doc-1')).toBeUndefined();
            expect(tabContext.documentIdsMap.get('doc-2')).toBe(MAIN_FRAME_ID);
            expect(tabContext.getFrameContextByDocumentId('doc-2')).toBe(mainFrame);
        });

        it('should keep document IDs for multiple frames', () => {
            const mainFrame = new FrameMV3({
                tabId: tabInfo.id,
                frameId: MAIN_FRAME_ID,
                parentFrameId: NO_PARENT_FRAME_ID,
                url: tabInfo.url!,
                timeStamp: Date.now(),
                documentId: 'doc-main',
            });
            const subFrame = new FrameMV3({
                tabId: tabInfo.id,
                frameId: 1,
                parentFrameId: MAIN_FRAME_ID,
                url: 'https://example.com/iframe',
                timeStamp: Date.now(),
                documentId: 'doc-sub',
            });

            tabContext.setFrameContext(MAIN_FRAME_ID, mainFrame);
            tabContext.setFrameContext(1, subFrame);
            tabContext.setDocumentId('doc-main', MAIN_FRAME_ID);
            tabContext.setDocumentId('doc-sub', 1);

            expect(tabContext.documentIdsMap.size).toBe(2);
            expect(tabContext.getFrameContextByDocumentId('doc-main')).toBe(mainFrame);
            expect(tabContext.getFrameContextByDocumentId('doc-sub')).toBe(subFrame);
        });

        it('should keep the document IDs map bounded across many main frame navigations', () => {
            const mainFrame = new FrameMV3({
                tabId: tabInfo.id,
                frameId: MAIN_FRAME_ID,
                parentFrameId: NO_PARENT_FRAME_ID,
                url: tabInfo.url!,
                timeStamp: Date.now(),
                documentId: 'doc-0',
            });

            tabContext.setFrameContext(MAIN_FRAME_ID, mainFrame);

            // Simulate a redirect loop: the main frame (which is never deleted)
            // navigates many times, each time receiving a brand new document ID.
            const navigationsCount = 1000;
            for (let i = 0; i < navigationsCount; i += 1) {
                const documentId = `doc-${i}`;
                mainFrame.documentId = documentId;
                tabContext.setDocumentId(documentId, MAIN_FRAME_ID);
            }

            // Stale document IDs must not accumulate: only the latest one remains.
            expect(tabContext.documentIdsMap.size).toBe(1);
            expect(tabContext.documentIdsMap.get(`doc-${navigationsCount - 1}`)).toBe(MAIN_FRAME_ID);
            expect(tabContext.getFrameContextByDocumentId(`doc-${navigationsCount - 1}`)).toBe(mainFrame);
        });
    });
});
