import browser from 'webextension-polyfill';

import { MAIN_FRAME_ID } from './constants';
import { Assistant } from './content-script/assistant/assistant';
import { type FrameCommon } from './tabs/frame';
import { type TabContextCommon } from './tabs/tab-context';
import { type TabInfoCommon } from './tabs/tabs-api';

export type CommonAssistantDetails = {
    tabId: number,
    frameId: number,
    url: string,
    timeStamp: number,
};

/**
 * Assistant class is the handler of messages and events related
 * to AdGuard assistant with extended detection of assistant frame.
 */
export class CommonAssistant extends Assistant {
    /**
     * Maximum time delay in milliseconds between the assistant frame creation and the assistant initialization.
     */
    private static FRAME_CREATION_LIMIT_MS = 300;

    /**
     * Assistant frame URL.
     */
    private static FRAME_URL = 'about:blank';

    /**
     * Checks whether the frame is an assistant frame. Two conditions must be met:
     * 1. The frame was created less than {@link Assistant.FRAME_CREATION_LIMIT_MS} milliseconds
     *    after the assistant initialization.
     * 2. The frame is a child of the main frame.
     *
     * @see {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1848}
     *
     * @param details Frame details of the onDomContentLoaded event.
     * @param tabContext Tab context.
     *
     * @returns True if the frame is an assistant frame, false otherwise.
     */
    public static async isAssistantFrame<F extends FrameCommon, T extends TabContextCommon<F, TabInfoCommon>>(
        details: CommonAssistantDetails,
        tabContext: T | undefined,
    ): Promise<boolean> {
        if (!tabContext || !tabContext?.assistantInitTimestamp) {
            return false;
        }

        const {
            tabId,
            frameId,
            url,
            timeStamp,
        } = details;

        const newFrameData = await browser.webNavigation.getFrame({ tabId, frameId });

        const timeSinceFrameCreatedMs = timeStamp - tabContext.assistantInitTimestamp;

        return timeSinceFrameCreatedMs < CommonAssistant.FRAME_CREATION_LIMIT_MS
            && url === CommonAssistant.FRAME_URL
            && newFrameData?.parentFrameId === MAIN_FRAME_ID;
    }
}
