import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { type ProcessShouldCollapsePayload } from '../../common/message';
// Import directly from files to avoid side effects of tree shaking.
// If import from '../../common', entire tsurlfilter will be in the package.
import { MessageType } from '../../common/message-constants';
import { sendAppMessage } from '../../common/content-script/send-app-message';
import { HIDING_STYLE, createHidingCssRule } from '../common/hidden-style';

type RequestInitiatorElement = HTMLElement & { src?: string; data?: string };

/**
 * Hides broken items after blocking a network request.
 */
export class ElementCollapser {
    private styleNode: HTMLStyleElement | undefined;

    /**
     * Creates new element collapser.
     */
    constructor() {
        this.shouldCollapseElement = this.shouldCollapseElement.bind(this);
    }

    /**
     * Starts listening for error events.
     */
    public start(): void {
        document.addEventListener('error', this.shouldCollapseElement, true);
        // We need to listen for load events to hide blocked iframes (they don't raise error event)
        document.addEventListener('load', this.shouldCollapseElement, true);
    }

    /**
     * Stops listening for error events.
     */
    public stop(): void {
        document.removeEventListener('error', this.shouldCollapseElement, true);
        // We need to listen for load events to hide blocked iframes (they don't raise error event)
        document.removeEventListener('load', this.shouldCollapseElement, true);
    }

    /**
     * Appends Css rule to {@link #styleNode} sheet.
     *
     * @param rule - Css rule text.
     */
    private appendCssRule(rule: string): void {
        if (!this.styleNode) {
            this.styleNode = document.createElement('style');
            this.styleNode.setAttribute('type', 'text/css');
            (document.head || document.documentElement).appendChild(this.styleNode);
        }

        if (this.styleNode.sheet) {
            this.styleNode.sheet.insertRule(rule, this.styleNode.sheet.cssRules.length);
        }
    }

    /**
     * Checks if element should be collapsed by requirements.
     *
     * @param event Error or load event.
     */
    private async shouldCollapseElement(event: Event): Promise<void> {
        const eventType = event.type;
        const element = event.target as RequestInitiatorElement;

        const tagName = element.tagName.toLowerCase();

        const expectedEventType = (tagName === 'iframe'
            || tagName === 'frame'
            || tagName === 'embed'
        ) ? 'load' : 'error';

        if (eventType !== expectedEventType) {
            return;
        }

        const requestType = ElementCollapser.getRequestTypeByInitiatorTagName(element.localName);

        if (!requestType) {
            return;
        }

        const elementUrl = ElementCollapser.getElementUrl(element);

        if (!elementUrl) {
            return;
        }

        if (ElementCollapser.isElementCollapsed(element)) {
            return;
        }

        const payload: ProcessShouldCollapsePayload = {
            elementUrl,
            documentUrl: document.URL,
            requestType,
        };

        const shouldCollapse = await sendAppMessage({
            type: MessageType.ProcessShouldCollapse,
            payload,
        });

        if (!shouldCollapse) {
            return;
        }

        const srcAttribute = element.getAttribute('src');

        if (srcAttribute) {
            const rule = createHidingCssRule(tagName, CSS.escape(srcAttribute));
            this.appendCssRule(rule);
        } else {
            element.setAttribute('style', HIDING_STYLE);
        }
    }

    /**
     * Returns request type by tag name.
     *
     * @param tagName Tag name.
     *
     * @returns Request type or null.
     */
    private static getRequestTypeByInitiatorTagName(tagName: string): RequestType | null {
        switch (tagName) {
            case 'img':
            case 'input': {
                return RequestType.Image;
            }
            case 'audio':
            case 'video': {
                return RequestType.Media;
            }
            case 'object':
            case 'embed': {
                return RequestType.Object;
            }
            case 'frame':
            case 'iframe':
                return RequestType.SubDocument;
            default:
                return null;
        }
    }

    /**
     * Extracts element URL from the dom node.
     *
     * @param element Dom node.
     *
     * @returns Element URL or null.
     */
    private static getElementUrl(element: RequestInitiatorElement): string | null {
        let elementUrl = element.src || element.data;
        if (!elementUrl
            || elementUrl.indexOf('http') !== 0
            // Some sources could not be set yet, lazy loaded images or smth.
            // In some cases like on gog.com, collapsing these elements could break
            // the page script loading their sources
            || elementUrl === element.baseURI) {
            return null;
        }

        // truncate too long urls
        // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/1493
        const MAX_URL_LENGTH = 16 * 1024;
        if (elementUrl.length > MAX_URL_LENGTH) {
            elementUrl = elementUrl.slice(0, MAX_URL_LENGTH);
        }

        return elementUrl;
    }

    /**
     * Checks if element is already collapsed.
     *
     * @param element DOM element.
     *
     * @returns True if element is collapsed.
     */
    private static isElementCollapsed(element: HTMLElement): boolean {
        const computedStyle = window.getComputedStyle(element);
        return (computedStyle && computedStyle.display === 'none');
    }
}
