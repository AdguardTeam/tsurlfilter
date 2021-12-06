import browser from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';
import { MessageType, Message, ProcessShouldCollapsePayload } from '../common';

type RequestInitiatorElement = HTMLElement & { src?: string, data?: string };

/**
 * Hides broken items after blocking a network request
 */
export class ElementCollapser {

    constructor(){
        this.shouldCollapseElement = this.shouldCollapseElement.bind(this);
    }

    public start() {
        document.addEventListener('error', this.shouldCollapseElement, true);
        // We need to listen for load events to hide blocked iframes (they don't raise error event)
        document.addEventListener('load', this.shouldCollapseElement, true);
    }

    public stop() {
        document.removeEventListener('error', this.shouldCollapseElement, true);
        // We need to listen for load events to hide blocked iframes (they don't raise error event)
        document.removeEventListener('load', this.shouldCollapseElement, true);
    }

    private async sendMessage(message: Message) {
        return browser.runtime.sendMessage(message);
    }

    private getRequestTypeByInitiatorTagName(tagName: string): RequestType | null {
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
    private getElementUrl(element: RequestInitiatorElement): string | null {
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


    private isElementCollapsed(element: HTMLElement): boolean {
        const computedStyle = window.getComputedStyle(element);
        return (computedStyle && computedStyle.display === 'none');
    }

    private async shouldCollapseElement(event: Event) {
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

        const requestType = this.getRequestTypeByInitiatorTagName(element.localName);

        if (!requestType) {
            return;
        }

        const elementUrl = this.getElementUrl(element);

        if (!elementUrl) {
            return;
        }

        if (this.isElementCollapsed(element)) {
            return;
        }

        const payload = {
            elementUrl,
            documentUrl: document.URL,
            requestType,
        } as ProcessShouldCollapsePayload;

        const shouldCollapse = await this.sendMessage({
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

export const elementCollapser = new ElementCollapser();
