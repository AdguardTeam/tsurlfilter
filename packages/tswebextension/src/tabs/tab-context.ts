import { Tabs } from 'webextension-polyfill';
import { NetworkRule } from '@adguard/tsurlfilter';

export interface Frame {
    id: number
    url: string
}

export interface TabContextInterface{
    info: Tabs.Tab
    frames: Map<number, Frame>
    frameRule?: NetworkRule
}

export class TabContext implements TabContextInterface {
    info: Tabs.Tab;

    frames = new Map<number, Frame>();

    frameRule: NetworkRule | undefined;

    constructor(info: Tabs.Tab){
        this.info = info;
    }

    updateTabInfo(changeInfo: Tabs.OnUpdatedChangeInfoType){
        this.info = Object.assign(this.info, changeInfo);
    }
}