import { RequestType } from '@adguard/tsurlfilter';

import { CosmeticApi } from '../cosmetic-api';

/**
 * Some html tags can trigger network requests.
 * If request is blocked by network rule, we try to collapse broken element from background page.
 */
export const enum InitiatorTag {
    Frame = 'frame',
    Iframe = 'iframe',
    Image = 'img',
}

export const BACKGROUND_TAB_ID = -1;

/**
 * Css, injected to broken element for hiding.
 */
// eslint-disable-next-line max-len
export const INITIATOR_TAG_HIDDEN_STYLE = '{ display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important; }';

/**
 * Returns network request initiator tag by request type.
 *
 * @param requestType Request type.
 * @returns Initiator tag.
 */
function getRequestInitiatorTag(requestType: RequestType): InitiatorTag[] | null {
    switch (requestType) {
        case RequestType.SubDocument:
            return [InitiatorTag.Iframe, InitiatorTag.Frame];
        case RequestType.Image:
            return [InitiatorTag.Image];
        default:
            return null;
    }
}

/**
 * Inject css for element hiding by tabs.injectCss.
 *
 * @param tabId Tab id.
 * @param requestFrameId Request frame id.
 * @param url Request url.
 * @param requestType Request type.
 * @param isThirdParty Flag telling if request is third-party.
 */
export function hideRequestInitiatorElement(
    tabId: number,
    requestFrameId: number,
    url: string,
    requestType: RequestType,
    isThirdParty: boolean,
): void {
    const initiatorTags = getRequestInitiatorTag(requestType);

    if (!initiatorTags || tabId === BACKGROUND_TAB_ID) {
        return;
    }

    // Strip the protocol and host name (for first-party requests) from the selector
    let srcUrlStartIndex = url.indexOf('//');
    if (!isThirdParty) {
        srcUrlStartIndex = url.indexOf('/', srcUrlStartIndex + 2);
    }
    const srcUrl = url.substring(srcUrlStartIndex);

    let code = '';

    for (let i = 0; i < initiatorTags.length; i += 1) {
        code += `${initiatorTags[i]}[src$="${srcUrl}"] ${INITIATOR_TAG_HIDDEN_STYLE}\n`;
    }

    CosmeticApi.injectCss(code, tabId, requestFrameId);
}
