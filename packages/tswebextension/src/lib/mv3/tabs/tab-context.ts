import { type NetworkRule } from '@adguard/tsurlfilter';

import { defaultFilteringLog, type FilteringLog } from '../../common/filtering-log';
import { type FrameConstructorProps } from '../../common/tabs/frame';
import { TabContextCommon } from '../../common/tabs/tab-context';
import { type TabInfo } from '../../common/tabs/tabs-api';
import { DocumentApi } from '../background/document-api';

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

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected matchFrame(url: string): NetworkRule | null {
        return DocumentApi.matchFrame(url);
    }

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected createFrame(props: FrameConstructorProps): FrameMV3 {
        return new FrameMV3(props);
    }

    /**
     * Creates context for new tab.
     *
     * @param tab Webextension API tab data.
     *
     * @returns Tab context for new tab.
     */
    public static createNewTabContext(tab: TabInfo): TabContext {
        const tabContext = new TabContext(tab);

        tabContext.initMainFrameFromTab(tab);

        return tabContext;
    }
}
