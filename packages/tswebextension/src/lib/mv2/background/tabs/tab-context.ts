import { Tabs } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';
import { engineApi } from '../engine-api';
import { Frame } from './frame';
import { allowlistApi } from '../allowlist';

export type TabMetadata = {
    mainFrameRule?: NetworkRule | null
    previousUrl?: string
    blockedRequestCount?: number
};
export interface TabContextInterface {
    info: Tabs.Tab
    frames: Map<number, Frame>
    metadata: TabMetadata

    updateTabInfo: (changeInfo: Tabs.OnUpdatedChangeInfoType) => void
    reloadTabFrameData: (frameUrl: string) => void
}

export const MAIN_FRAME_ID = 0;
export class TabContext implements TabContextInterface {
    info: Tabs.Tab;

    frames = new Map<number, Frame>();

    metadata: TabMetadata = {};

    constructor(info: Tabs.Tab) {
        this.updateTabInfo = this.updateTabInfo.bind(this);
        this.reloadTabFrameData = this.reloadTabFrameData.bind(this);

        this.info = info;

        if (info.url) {
            this.reloadTabFrameData(info.url);
        }
    }

    updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        this.info = Object.assign(this.info, changeInfo);
    }

    updateBlockedRequestCount(increment: number) {
        const blockedRequestCount = (this.metadata.blockedRequestCount || 0) + increment;
        this.metadata.blockedRequestCount = blockedRequestCount;

        return blockedRequestCount;
    }

    updateMainFrameRule(): void {
        const mainFrame = this.frames.get(MAIN_FRAME_ID);

        const mainFrameRule = mainFrame?.url
            ? engineApi.matchFrame(mainFrame?.url)
            : null;

        this.metadata.mainFrameRule = mainFrameRule;
    }

    reloadTabFrameData(url: string): void {
        const previousUrl = this.frames.get(MAIN_FRAME_ID)?.url;

        this.frames.clear();
        this.frames.set(MAIN_FRAME_ID, new Frame({ url }));

        this.metadata = {
            mainFrameRule: allowlistApi.matchFrame(url),
            previousUrl,
        };
    }
}
