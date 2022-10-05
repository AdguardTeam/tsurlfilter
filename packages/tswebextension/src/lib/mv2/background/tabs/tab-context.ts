import { Tabs } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';
import { Frame } from './frame';
import { allowlistApi } from '../allowlist';
import { RequestContext } from '../request';

export type TabMetadata = {
    mainFrameRule?: NetworkRule | null
    previousUrl?: string
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
export class TabContext implements TabContextInterface {
    info: Tabs.Tab;

    frames = new Map<number, Frame>();

    metadata: TabMetadata = {};

    // We mark this tabs as synthetic because actually they may not exists
    isSyntheticTab = true;

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

    updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        this.info = Object.assign(this.info, changeInfo);

        // If the tab was updated it means that it wasn't used to send requests in the background
        this.isSyntheticTab = false;
    }

    updateBlockedRequestCount(increment: number) {
        const blockedRequestCount = (this.metadata.blockedRequestCount || 0) + increment;
        this.metadata.blockedRequestCount = blockedRequestCount;

        return blockedRequestCount;
    }

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

    setMainFrameByFrameUrl(url: string) {
        const previousUrl = this.getPreviousUrl();

        this.frames.clear();

        this.frames.set(MAIN_FRAME_ID, new Frame(url));

        this.metadata = {
            mainFrameRule: allowlistApi.matchFrame(url),
            previousUrl,
        };
    }

    setMainFrameByRequestContext(requestContext: RequestContext): void {
        const { requestUrl } = requestContext;
        const previousUrl = this.getPreviousUrl();

        this.frames.clear();

        this.frames.set(MAIN_FRAME_ID, new Frame(requestUrl, requestContext));

        this.metadata = {
            mainFrameRule: allowlistApi.matchFrame(requestContext.requestUrl),
            previousUrl,
        };
    }

    private getPreviousUrl(): string | undefined {
        const mainFrame = this.frames.get(MAIN_FRAME_ID);

        if (!mainFrame) {
            return;
        }

        return mainFrame.url;
    }
}
