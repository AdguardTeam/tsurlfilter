import browser from 'webextension-polyfill';
import { RequestType } from '@adguard/tsurlfilter';
import ExtendedCss from 'extended-css';
import StealthHelper from './stealth-helper';
import CookieController from './cookie-controller';
import CssHitsCounter from './css-hits-counter';
import { MessageType, Message, ProcessShouldCollapsePayload } from '../common';

/**
 * This module exports libraries used in the extension via content scripts
 */
export default { ExtendedCss, StealthHelper, CookieController, CssHitsCounter };

// TODO: code decomposition

type RequestInitiatorElement = HTMLElement & { src?: string, data?: string };

async function sendMessage(message: Message) {
    return browser.runtime.sendMessage(message);
}

function getRequestTypeByInitiatorTagName(tagName: string): RequestType | null {
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
const getElementUrl = function (element: RequestInitiatorElement): string | null {
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
};


function isElementCollapsed(element: HTMLElement): boolean {
    const computedStyle = window.getComputedStyle(element);
    return (computedStyle && computedStyle.display === 'none');
}

/**
 * Checks if loaded element is blocked by AG and should be hidden
 */
async function shouldCollapseElement(event: Event) {
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

    const requestType = getRequestTypeByInitiatorTagName(element.localName);

    if (!requestType) {
        return;
    }

    const elementUrl = getElementUrl(element);

    if (!elementUrl) {
        return;
    }

    if (isElementCollapsed(element)){
        return;
    }

    const payload = {
        elementUrl,
        documentUrl: document.URL,
        requestType,
    } as ProcessShouldCollapsePayload;

    const shouldCollapse = await sendMessage({
        type: MessageType.PROCESS_SHOULD_COLLAPSE,
        payload,
    });

    if (!shouldCollapse){
        return;
    }

    element.setAttribute('style', 'display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important;');
}

document.addEventListener('error', shouldCollapseElement, true);
// We need to listen for load events to hide blocked iframes (they don't raise error event)
document.addEventListener('load', shouldCollapseElement, true);
