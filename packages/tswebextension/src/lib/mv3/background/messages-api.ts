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

export default class MessagesApi {
    private tsWebExtension: TsWebExtension;

    constructor(tsWebExtension: TsWebExtension) {
        this.tsWebExtension = tsWebExtension;
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Handles message
     * @param message
     * @returns
     */
    public async handleMessage(message: Message) {
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
                return this.getCss(message.payload);
            }
            default: {
                console.error('Did not found handler for message');
            }
        }
    }

    /**
     * Builds css for specified url
     * @param payload object which contains
     * @returns cosmetic css
     */
    private getCss(payload?: unknown) {
        console.debug('[GET CSS]: received call');
        const res = getCssPayloadValidator.safeParse(payload);

        if (!res.success) {
            return;
        }

        const isFilteringOn = this.tsWebExtension.isStarted;

        if (isFilteringOn) {
            return engineApi.buildCosmeticCss(
                res.data.url,
                CosmeticOption.CosmeticOptionAll,
                false,
                false,
            );
        }
    }
}
