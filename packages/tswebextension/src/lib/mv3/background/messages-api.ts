/* eslint-disable class-methods-use-this */
import { CosmeticOption } from '@adguard/tsurlfilter';

import {
    messageValidator,
    Message,
    MessageType,
    getCssPayloadValidator,
} from '../../common';
import { engineApi } from './engine-api';
import { TsWebExtension } from './app';
import { isHttpOrWsRequest } from '../../common/utils';

export default class MessagesApi {
    private tsWebExtension: TsWebExtension;

    constructor(tsWebExtension: TsWebExtension) {
        this.tsWebExtension = tsWebExtension;
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Handles message
     * @param message message
     * @param sender sender of message
     * @returns data according to the received message
     */
    public async handleMessage(message: Message, sender: chrome.runtime.MessageSender) {
        console.debug('[HANDLE MESSAGE]: ', message);

        try {
            message = messageValidator.parse(message);
        } catch (e) {
            console.error('Bad message', message);
            // ignore
            return;
        }

        const { type } = message;

        switch (type) {
            case MessageType.GET_CSS: {
                console.debug('[HANDLE MESSAGE]: call getCss');

                const res = getCssPayloadValidator.safeParse(message.payload);
                if (!res.success) {
                    return;
                }

                let { url } = res.data;

                // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1498
                // when document url for iframe is about:blank then we use tab url
                if (!isHttpOrWsRequest(url) && sender.frameId !== 0 && sender.tab?.url) {
                    url = sender.tab.url;
                }

                return this.getCss(url);
            }
            default: {
                console.error('Did not found handler for message');
            }
        }
    }

    /**
     * Builds css for specified url
     * @param url url for which build css
     * @returns cosmetic css
     */
    private getCss(url: string) {
        console.debug('[GET CSS]: received call', url);

        if (this.tsWebExtension.isStarted) {
            return engineApi.buildCosmeticCss(
                url,
                CosmeticOption.CosmeticOptionAll,
                false,
                false,
            );
        }
    }
}
