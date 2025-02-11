import { MAIN_FRAME_ID } from '../../../common/constants';
import { defaultFilteringLog, type FilteringLog } from '../../../common/filtering-log';
import { isHttpOrWsRequest } from '../../../common/utils/url';
import { TabContextCommon } from '../../../common/tabs/tab-context';
import { type TabInfo } from '../../../common/tabs/tabs-api';
import { type DocumentApi } from '../document-api';

import { FrameMV2 } from './frame';

/**
 * Tab context for MV2.
 */
export class TabContext extends TabContextCommon<FrameMV2> {
    /**
     * Context constructor.
     *
     * @param info Webextension API tab data.
     * @param documentApi Document API.
     * @param filteringLog Filtering Log API.
     */
    constructor(
        public info: TabInfo,
        private readonly documentApi: DocumentApi,
        protected readonly filteringLog: FilteringLog = defaultFilteringLog,
    ) {
        super(info, filteringLog);
    }

    // TODO: consider moving to common class AG-39552.
    /**
     * Creates context for new tab.
     *
     * @param tab Webextension API tab data.
     * @param documentApi Document API.
     *
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfo, documentApi: DocumentApi): TabContext {
        const tabContext = new TabContext(tab, documentApi);

        // In some cases, tab is created while browser navigation processing.
        // For example: when you navigate outside the browser or create new empty tab.
        // `pendingUrl` represent url navigated to. We check it first.
        // If server returns redirect, new main frame url will be processed in WebRequestApi.
        const url = tab.pendingUrl || tab.url;

        if (url && isHttpOrWsRequest(url)) {
            tabContext.mainFrameRule = documentApi.matchFrame(url);

            tabContext.frames.set(MAIN_FRAME_ID, new FrameMV2({
                tabId: tab.id,
                frameId: MAIN_FRAME_ID,
                url,
                // timestamp is 0, so that it will be recalculated in the next event
                timeStamp: 0,
            }));
        }

        return tabContext;
    }
}
