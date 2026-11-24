import { type NetworkRule } from '@adguard/tsurlfilter';

import { defaultFilteringLog, type FilteringLog } from '../../../common/filtering-log';
import { type FrameConstructorProps } from '../../../common/tabs/frame';
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

    /**
     * @inheritdoc
     */
    protected matchFrame(url: string): NetworkRule | null {
        return this.documentApi.matchFrame(url);
    }

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected createFrame(props: FrameConstructorProps): FrameMV2 {
        return new FrameMV2(props);
    }

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

        tabContext.initMainFrameFromTab(tab);

        return tabContext;
    }
}
