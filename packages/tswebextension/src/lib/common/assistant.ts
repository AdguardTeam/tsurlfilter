/**
 * @file
 * In the content script, we need access to @adguard/assistant only when
 * the user clicks 'block ad manually'.
 * Therefore, we exclude @adguard/assistant from the bundled content-script code
 * and load it on-demand. We also added a required field to the configuration
 * object to ensure the assistant is bundled inside the final extension,
 * allowing tswebextension to load it on-demand.
 *
 * Schema:
 * - Buildtime:
 *  -- [tswebext]  Script to inject assistant from the URL provided by the extension.
 *  -- [tswebext]  Assistant controller script for interacting with the assistant. <--- current file.
 *  -- [tswebext]  Assistant messages listener on the content-script side.
 *  -- [extension] Entry point script for injecting the assistant
 * - Runtime:
 *  -- [tswebext] Content script injects into every new tab without the assistant.
 *  -- [tswebext] On-demand content script dynamically injects the assistant.
 *  -- [tswebext] After injection, the content script interacts with the assistant.
 *
 * Reference code: ASSISTANT_INJECT.
 */
import browser from 'webextension-polyfill';

import { MAIN_FRAME_ID } from './constants';
import { EventChannel } from './utils/channels';
import { MessageType } from './message-constants';
import { type FrameCommon } from './tabs/frame';
import { type TabContextCommon } from './tabs/tab-context';

/**
 * Data needed to determine whether the frame is an assistant frame.
 */
export type CommonAssistantDetails = {
    /**
     * Frame ID.
     */
    frameId: number;

    /**
     * Frame URL.
     */
    url: string;

    /**
     * Timestamp of the event.
     */
    timeStamp: number;
};

/**
 * Abstract assistant class is the handler of messages and events related
 * to AdGuard assistant.
 * Should be extended by the specific assistant implementation for executing
 * script for injecting assistant.
 */
export abstract class CommonAssistant {
    /**
     * Maximum time delay in milliseconds between the assistant frame creation and the assistant initialization.
     */
    private static FRAME_CREATION_LIMIT_MS = 200;

    /**
     * Assistant frame URL.
     */
    private static FRAME_URL = 'about:blank';

    /**
     * Fires when a rule has been created from the AdGuard assistant.
     */
    public static onCreateRule = new EventChannel<string>();

    /**
     * Path to assembled @adguard/assistant module. Necessary for lazy on-demand
     * loading of the assistant.
     */
    private static assistantUrl = '';

    /**
     * Sets assistant url to the static variable. This method needs because we
     * currently use extended assistant class in both MV2 and MV3 and via directly set
     * CommonAssistant.assistantUrl it will not set filed inside super class itself.
     *
     * @param url Path to assistant, see {@link CommonAssistant.assistantUrl}.
     */
    public static setAssistantUrl(url: string): void {
        CommonAssistant.assistantUrl = url;
    }

    /**
     * Dynamically inject AdGuard assistant to the tab and after it opens it.
     *
     * @param tabId The ID of the tab where is needed to inject and open
     * the AdGuard assistant.
     */
    public async openAssistant(tabId: number): Promise<void> {
        if (!CommonAssistant.assistantUrl) {
            throw new Error('Path to bundled assistant-inject file is not set up.');
        }

        // Inject assistant to the frame, before accessing it.
        await this.injectAssistant(tabId, CommonAssistant.assistantUrl);

        // After injection we can request opening it.
        await browser.tabs.sendMessage(tabId, {
            type: MessageType.InitAssistant,
        });
    }

    /**
     * Closes the AdGuard Assistant frame in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to close
     * the AdGuard assistant.
     */
    public static async closeAssistant(tabId: number): Promise<void> {
        await browser.tabs.sendMessage(tabId, {
            type: MessageType.CloseAssistant,
        });
    }

    /**
     * Injects the assistant to the tab.
     *
     * @param tabId The ID of the tab where is needed to inject the AdGuard assistant.
     * @param fileUrl The URL of the file to inject.
     */
    protected abstract injectAssistant(tabId: number, fileUrl: string): Promise<unknown[]>;

    /**
     * Checks whether the frame is an assistant frame. Two conditions must be met:
     * 1. The frame was created less than {@link CommonAssistant.FRAME_CREATION_LIMIT_MS}
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
    public static isAssistantFrame(
        details: CommonAssistantDetails,
        tabContext: TabContextCommon<FrameCommon> | undefined,
    ): boolean {
        if (!tabContext || !tabContext.assistantInitTimestamp) {
            return false;
        }

        const {
            frameId,
            url,
            timeStamp,
        } = details;

        const frameContext = tabContext.getFrameContext(frameId);
        if (!frameContext) {
            return false;
        }

        const timeSinceFrameCreatedMs = timeStamp - tabContext.assistantInitTimestamp;

        return timeSinceFrameCreatedMs < CommonAssistant.FRAME_CREATION_LIMIT_MS
            && frameContext.parentFrameId === MAIN_FRAME_ID
            && url === CommonAssistant.FRAME_URL;
    }
}
