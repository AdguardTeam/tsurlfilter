import { CommonAssistant } from '../../common/assistant';

/**
 * Assistant class is the handler of messages and events related
 * to AdGuard assistant with extended detection of assistant frame.
 */
export class Assistant extends CommonAssistant {
    /**
     * @inheritdoc
     */
    // eslint-disable-next-line class-methods-use-this
    protected injectAssistant(tabId: number, fileUrl: string): Promise<unknown[]> {
        /**
         * Using `chrome.scripting.executeScript` here is safe since the fileUrl
         * is a static file from the extension's directory, i.e. pre-built
         * and verified.
         */
        return chrome.scripting.executeScript({
            target: { tabId },
            files: [fileUrl],
        });
    }
}

export const assistant = new Assistant();
