import { Tabs } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';
import { engineApi } from '../engine-api';
import { getDomain } from '../utils';

export interface Frame {
    url: string
}
export interface TabMetadata {
    frameRule?: NetworkRule | null,
    previousUrl?: string
}
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
        this.reloadTabFrameData = this.reloadTabFrameData.bind(this)

        this.info = info;

        if (info.url) {
            this.reloadTabFrameData(info.url);
        }
    }

    updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType): void {
        this.info = Object.assign(this.info, changeInfo);

        if (changeInfo.url) {
            this.reloadTabFrameData(changeInfo.url)
        }
    }

    reloadTabFrameData(frameUrl: string): void {
        const previousUrl = this.frames.get(MAIN_FRAME_ID)?.url;

        const url = getDomain(frameUrl) || frameUrl;

        this.frames.clear();
        this.frames.set(MAIN_FRAME_ID, { url });

        this.metadata = {
            frameRule: engineApi.matchFrame(frameUrl),
            previousUrl
        }
    }
}