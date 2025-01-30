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
 *
 */
import browser from 'webextension-polyfill';

import { EventChannel } from '../../utils/channels';
import { MessageType } from '../../message-constants';

/**
 * Assistant class is the handler of messages and events related
 * to AdGuard assistant.
 */
export class Assistant {
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
     * currently use extended assistant class in mv2 and via directly set
     * AssistantMv2.assistantUrl it will not set filed inside super class itself.
     *
     * @param url Path to assistant, see @see {@link Assistant.assistantUrl}.
     */
    public static setAssistantUrl(url: string): void {
        Assistant.assistantUrl = url;
    }

    /**
     * Dynamically inject AdGuard assistant to the tab and after it opens it.
     *
     * @param tabId The ID of the tab where is needed to inject and open
     * the AdGuard assistant.
     */
    public static async openAssistant(tabId: number): Promise<void> {
        if (!Assistant.assistantUrl) {
            throw new Error('Path to bundled assistant-inject file is not set up.');
        }

        // Inject assistant to the frame, before accessing it.
        await browser.tabs.executeScript(
            tabId,
            { file: Assistant.assistantUrl },
        );

        // After injection we can request opening it.
        await browser.tabs.sendMessage(tabId, {
            type: MessageType.InitAssistant,
        });
    }

    /**
     * Closes the AdGuard assistant in the specified tab.
     *
     * @param tabId The ID of the tab where is needed to close
     * the AdGuard assistant.
     */
    public static async closeAssistant(tabId: number): Promise<void> {
        await browser.tabs.sendMessage(tabId, {
            type: MessageType.CloseAssistant,
        });
    }
}
