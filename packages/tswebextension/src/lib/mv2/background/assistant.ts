import browser, { type WebNavigation } from 'webextension-polyfill';
import { EventChannel, MessageType } from '../../common';
import { messagesApi } from './api';
import { MAIN_FRAME_ID, type TabContext } from './tabs';

/**
 * Event channel wrapper for sending messages to the assistant.
 */
export class Assistant {
    /**
     * Maximum time delay in milliseconds between the assistant frame creation and the assistant initialization.
     */
    private static FRAME_CREATION_LIMIT_MS = 200;

    /**
     * Assistant frame URL.
     */
    private static FRAME_URL = 'about:blank';

    public static onCreateRule = new EventChannel<string>();

    /**
     * Path to assembled @adguard/assistant module. Necessary for lazy on-demand
     * loading of the assistant.
     */
    public static assistantUrl = '';

    /**
     * Sends message to assistant to open it on the page.
     *
     * @param tabId Tab id.
     */
    public static async openAssistant(tabId: number): Promise<void> {
        // Lazy load assistant
        await browser.tabs.executeScript(
            tabId,
            { file: this.assistantUrl },
        );

        await messagesApi.sendMessage(tabId, {
            type: MessageType.InitAssistant,
            tabId,
            assistantUrl: this.assistantUrl,
        });
    }

    /**
     * Sends message to assistant to close it on the page.
     *
     * @param tabId Tab id.
     */
    public static async closeAssistant(tabId: number): Promise<void> {
        await messagesApi.sendMessage(tabId, {
            type: MessageType.CloseAssistant,
        });
    }

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
}
