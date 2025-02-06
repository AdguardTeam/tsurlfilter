import browser, { type WebNavigation } from 'webextension-polyfill';

import { MAIN_FRAME_ID } from '../../common/constants';
import { CommonAssistant } from '../../common/assistant';

import { type TabContext } from './tabs';

/**
 * Assistant class is the handler of messages and events related
 * to AdGuard assistant with extended detection of assistant frame.
 */
export class Assistant extends CommonAssistant {
    /**
     * Maximum time delay in milliseconds between the assistant frame creation and the assistant initialization.
     */
    private static FRAME_CREATION_LIMIT_MS = 200;

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
    public static async isAssistantFrame(
        details: WebNavigation.OnDOMContentLoadedDetailsType,
        tabContext: TabContext | undefined,
    ): Promise<boolean> {
        if (!tabContext || !tabContext?.assistantInitTimestamp) {
            return false;
        }

        const {
            tabId,
            url,
            frameId,
            timeStamp,
        } = details;

        const newFrameData = await browser.webNavigation.getFrame({ tabId, frameId });

        const timeSinceFrameCreatedMs = timeStamp - tabContext.assistantInitTimestamp;

        return timeSinceFrameCreatedMs < Assistant.FRAME_CREATION_LIMIT_MS
            && url === Assistant.FRAME_URL
            && newFrameData?.parentFrameId === MAIN_FRAME_ID;
    }

    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected injectAssistant(tabId: number, fileUrl: string): Promise<unknown[]> {
        return browser.tabs.executeScript(tabId, { file: fileUrl });
    }
}

export const assistant = new Assistant();
