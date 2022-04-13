import { RequestType } from '@adguard/tsurlfilter';
import { ProcessShouldCollapsePayload, MessageType, sendAppMessage } from '../../common';

type RequestInitiatorElement = HTMLElement & { src?: string, data?: string };

/**
 * Hides broken items after blocking a network request
 */
export class ElementCollapser {
    public static start() {
        document.addEventListener('error', ElementCollapser.shouldCollapseElement, true);
        // We need to listen for load events to hide blocked iframes (they don't raise error event)
        document.addEventListener('load', ElementCollapser.shouldCollapseElement, true);
    }

    public static stop() {
        document.removeEventListener('error', ElementCollapser.shouldCollapseElement, true);
        // We need to listen for load events to hide blocked iframes (they don't raise error event)
        document.removeEventListener('load', ElementCollapser.shouldCollapseElement, true);
    }

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
                return RequestType.Subdocument;
            default:
                return null;
        }
    }

    /**
     * Extracts element URL from the dom node
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

    private static isElementCollapsed(element: HTMLElement): boolean {
        const computedStyle = window.getComputedStyle(element);
        return (computedStyle && computedStyle.display === 'none');
    }

    private static async shouldCollapseElement(event: Event) {
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

        const payload = {
            elementUrl,
            documentUrl: document.URL,
            requestType,
        } as ProcessShouldCollapsePayload;

        const shouldCollapse = await sendAppMessage({
            type: MessageType.PROCESS_SHOULD_COLLAPSE,
            payload,
        });

        if (!shouldCollapse) {
            return;
        }

        element.setAttribute(
            'style',
            'display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important;',
        );
    }
}
