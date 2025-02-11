import { type FilteringLog, defaultFilteringLog } from '../../common/filtering-log';
import { isHttpOrWsRequest } from '../../common/utils/url';
import { TabContextCommon } from '../../common/tabs/tab-context';
import { type TabInfo } from '../../common/tabs/tabs-api';
import { DocumentApi } from '../background/document-api';
import { MAIN_FRAME_ID } from '../../common/constants';

import { FrameMV3 } from './frame';

/**
 * Tab context.
 */
export class TabContext extends TabContextCommon<FrameMV3> {
    /**
     * Context constructor.
     *
     * @param info Webextension API tab data.
     * @param filteringLog Filtering Log API.
     */
    constructor(
        public info: TabInfo,
        protected readonly filteringLog: FilteringLog = defaultFilteringLog,
    ) {
        super(info, filteringLog);
    }

    // TODO: consider moving to common class AG-39552.
    /**
     * Creates context for new tab.
     *
     * @param tab Webextension API tab data.
     *
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfo): TabContext {
        const tabContext = new TabContext(tab);

        // In some cases, tab is created while browser navigation processing.
        // For example: when you navigate outside the browser or create new empty tab.
        // `pendingUrl` represent url navigated to. We check it first.
        // If server returns redirect, new main frame url will be processed in WebRequestApi.
        const url = tab.pendingUrl || tab.url;

        if (url && isHttpOrWsRequest(url)) {
            tabContext.mainFrameRule = DocumentApi.matchFrame(url);

            tabContext.frames.set(MAIN_FRAME_ID, new FrameMV3({
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
