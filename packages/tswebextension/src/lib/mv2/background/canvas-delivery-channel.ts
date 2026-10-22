import browser from 'webextension-polyfill';

import { NO_PARENT_FRAME_ID } from '../../common/constants';
import { logger } from '../../common/utils/logger';
import { isHttpRequest } from '../../common/utils/url';
import { CanvasDeliveryUrl } from '../common/canvas-delivery';

import { type ChromiumMv2CanvasInjection } from './canvas-injection';
import { type OnBeforeRequestDetailsType } from './request/events/request-events';
import { type TabsApi } from './tabs/tabs-api';

/**
 * Answers the synchronous request of the content script for the canvas protection page script
 * in Chromium MV2. The request goes to a reserved host, and a blocking listener redirects it
 * to a `data:` URL carrying the page script, or nothing when the document is not protected.
 *
 * Each document gets one answer: the page knows the reserved URL and could repeat the request,
 * but it learns at most its own site key, which the inserted script exposes anyway.
 *
 * TODO: remove when Chromium MV2 is no longer supported.
 */
export class ChromiumMv2CanvasDeliveryChannel {
    /**
     * Number of answered documents remembered. It is far above the number of documents alive
     * at once in a browser and keeps the set small.
     */
    public static readonly MAX_ANSWERED_DOCUMENTS = 4096;

    private static readonly DATA_URL_PREFIX = 'data:text/javascript;charset=utf-8,';

    /**
     * IDs of answered documents; insertion order evicts the oldest first.
     */
    private readonly answered = new Set<string>();

    private listening = false;

    /**
     * Creates the channel.
     *
     * @param injection Delivery that builds the page script.
     * @param tabsApi Tabs API with the frame contexts.
     */
    constructor(
        private readonly injection: ChromiumMv2CanvasInjection,
        private readonly tabsApi: TabsApi,
    ) {}

    /**
     * Starts answering the requests of the content script. Repeated calls do nothing.
     */
    public listen(): void {
        if (this.listening) {
            return;
        }
        this.listening = true;
        browser.webRequest.onBeforeRequest.addListener(
            (details) => this.answer(details),
            { urls: [CanvasDeliveryUrl.PATTERN] },
            ['blocking'],
        );
    }

    /**
     * Answers a request with the page script of its document. The listener never throws:
     * a throw would leave the blocking request unanswered.
     *
     * @param details Details of the request to the reserved host.
     *
     * @returns Redirect to a `data:` URL with the page script, empty when nothing is delivered.
     */
    public answer(details: OnBeforeRequestDetailsType): { redirectUrl: string } {
        const script = this.getPageScript(details) ?? '';
        return { redirectUrl: `${ChromiumMv2CanvasDeliveryChannel.DATA_URL_PREFIX}${encodeURIComponent(script)}` };
    }

    /**
     * Finds the page script for the document that sent the request.
     *
     * @param details Details of the request to the reserved host.
     *
     * @returns The page script, or `undefined` when nothing is delivered.
     */
    private getPageScript(details: OnBeforeRequestDetailsType): string | undefined {
        const {
            documentId,
            tabId,
            frameId,
            parentFrameId,
            initiator,
        } = details;

        if (!documentId) {
            logger.debug(`[tsweb.ChromiumMv2CanvasDeliveryChannel.getPageScript]: no documentId in tab ${tabId}, frame ${frameId}`);
            return undefined;
        }

        if (this.answered.has(documentId)) {
            logger.debug(`[tsweb.ChromiumMv2CanvasDeliveryChannel.getPageScript]: document ${documentId} was answered before`);
            return undefined;
        }
        this.remember(documentId);

        const frame = this.tabsApi.getFrameContext(tabId, frameId);
        if (!frame) {
            logger.debug(`[tsweb.ChromiumMv2CanvasDeliveryChannel.getPageScript]: no frame context for tab ${tabId}, frame ${frameId}`);
            return undefined;
        }

        const { url } = frame;
        if (!initiator || initiator === 'null' || !isHttpRequest(url) || new URL(url).origin !== initiator) {
            logger.debug(`[tsweb.ChromiumMv2CanvasDeliveryChannel.getPageScript]: initiator ${initiator} does not match frame URL ${url}`);
            return undefined;
        }

        const topUrl = parentFrameId === NO_PARENT_FRAME_ID ? url : this.getCommittedTopUrl(tabId);
        if (topUrl === undefined) {
            logger.debug(`[tsweb.ChromiumMv2CanvasDeliveryChannel.getPageScript]: no committed top-level web page in tab ${tabId}`);
            return undefined;
        }

        return this.injection.getPageScript({ url, topUrl });
    }

    /**
     * Returns the top-level URL of a tab while it is not in flux. The main frame context
     * is replaced when a navigation, prefetch or prerender starts, and the tab URL changes
     * only after a commit; when both agree on the hostname, neither is in flux. Hostnames
     * are compared, because the protection decision reads the top URL only through it.
     *
     * @param tabId Tab ID.
     *
     * @returns The committed top-level URL, or `undefined` when it is unknown, not a web page,
     * or in flux.
     */
    private getCommittedTopUrl(tabId: number): string | undefined {
        const mainFrameUrl = this.tabsApi.getMainFrameUrl(tabId);
        const tabUrl = this.tabsApi.getTabContext(tabId)?.info.url;
        if (!isHttpRequest(mainFrameUrl) || !isHttpRequest(tabUrl)) {
            return undefined;
        }
        return new URL(mainFrameUrl!).hostname === new URL(tabUrl!).hostname ? tabUrl : undefined;
    }

    /**
     * Records an answered document, evicting the oldest one beyond the bound.
     *
     * @param documentId Document ID.
     */
    private remember(documentId: string): void {
        this.answered.add(documentId);
        if (this.answered.size > ChromiumMv2CanvasDeliveryChannel.MAX_ANSWERED_DOCUMENTS) {
            const [oldest] = this.answered;
            this.answered.delete(oldest);
        }
    }
}
