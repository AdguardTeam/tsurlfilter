import { Tabs } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';
import { Frame } from './frame';
import { allowlistApi } from '../allowlist';
import { RequestContext } from '../request';

export type TabMetadata = {
    mainFrameRule?: NetworkRule | null
    blockedRequestCount?: number
};

export interface TabContextInterface {
    info: Tabs.Tab
    frames: Map<number, Frame>
    metadata: TabMetadata

    isSyntheticTab: boolean

    updateTabInfo: (changeInfo: Tabs.OnUpdatedChangeInfoType) => void
    updateBlockedRequestCount: (increment: number) => void
    updateMainFrameRule: () => void

    setMainFrameByFrameUrl: (url: string) => void;
    setMainFrameByRequestContext: (requestContext: RequestContext) => void
}

export const MAIN_FRAME_ID = 0;

/**
 * Tab context with methods to work with frames and metadata.
 */
export class TabContext implements TabContextInterface {
    info: Tabs.Tab;

    frames = new Map<number, Frame>();

    metadata: TabMetadata = {};

    // We mark this tabs as synthetic because actually they may not exist
    isSyntheticTab = true;

    /**
     * Context constructor.
     *
     * @param info Tab info.
     */
    constructor(info: Tabs.Tab) {
        this.updateTabInfo = this.updateTabInfo.bind(this);
        this.updateBlockedRequestCount = this.updateBlockedRequestCount.bind(this);
        this.setMainFrameByFrameUrl = this.setMainFrameByFrameUrl.bind(this);
        this.setMainFrameByRequestContext = this.setMainFrameByRequestContext.bind(this);

        this.info = info;

        if (info.url) {
            this.setMainFrameByFrameUrl(info.url);
        }
    }

    /**
     * Updates tab info with new values.
     *
     * @param changeInfo Tab change info.
     */
    updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        this.info = Object.assign(this.info, changeInfo);

        // If the tab was updated it means that it wasn't used to send requests in the background
        this.isSyntheticTab = false;
    }

    /**
     * Updates blocked requests count.
     *
     * @param increment Count to add value.
     * @returns Total blocked requests count.
     */
    updateBlockedRequestCount(increment: number): number {
        const blockedRequestCount = (this.metadata.blockedRequestCount || 0) + increment;
        this.metadata.blockedRequestCount = blockedRequestCount;

        return blockedRequestCount;
    }

    /**
     * Updates main frame rule.
     */
    updateMainFrameRule(): void {
        let mainFrameRule = null;

        const mainFrame = this.frames.get(MAIN_FRAME_ID);

        if (!mainFrame?.url) {
            return;
        }

        const { url } = mainFrame;

        mainFrameRule = allowlistApi.matchFrame(url);

        this.metadata.mainFrameRule = mainFrameRule;
    }

    /**
     * // TODO add info why we need previous url.
     * Sets main frame by frame url.
     *
     * @param url Url for main frame.
     */
    setMainFrameByFrameUrl(url: string): void {
        this.frames.clear();

        this.frames.set(MAIN_FRAME_ID, new Frame(url));

        this.metadata = {
            mainFrameRule: allowlistApi.matchFrame(url),
        };
    }

    /**
     * // TODO answer why we need this method?
     * Sets main frame by request context.
     *
     * @param requestContext Request context.
     */
    setMainFrameByRequestContext(requestContext: RequestContext): void {
        const { requestUrl } = requestContext;

        this.frames.clear();

        this.frames.set(MAIN_FRAME_ID, new Frame(requestUrl, requestContext));

        this.metadata = {
            mainFrameRule: allowlistApi.matchFrame(requestContext.requestUrl),
        };
    }
}
