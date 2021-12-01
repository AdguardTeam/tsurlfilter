import { RequestType } from '@adguard/tsurlfilter';

import { cosmeticApi } from '../cosmetic-api';

/**
 * Some html tags can trigger network requests. 
 * If request is blocked by network rule, we try to collapse broken element from backgound page
 */
const enum InitiatorTag {
    FRAME = 'frame',
    IFRAME = 'iframe',
    IMAGE = 'img',
}



const BACKGROUND_TAB_ID = -1;

/**
 * Css, injected to broken element for hiding
 */
// eslint-disable-next-line max-len
const INITIATOR_TAG_HIDDEN_STYLE = '{ display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important; }';


/**
 * match network request initiator tag by request type 
 */
function getRequestInitiatorTag(requestType: RequestType): InitiatorTag[] | null {
    switch (requestType){
        case RequestType.Subdocument:
            return [InitiatorTag.IFRAME, InitiatorTag.FRAME];
        case RequestType.Image:
            return [InitiatorTag.IMAGE];
        default:
            return null;
    }
}

/**
 * Inject css for element hiding by tabs.injectCss
 */
export function hideRequestInitiatorElement(
    tabId: number, 
    requestFrameId: number,
    url: string,
    requestType: RequestType,
    isThirdParty: boolean,
) {

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

    for (let i = 0; i < initiatorTags.length; i++){
        code += `${initiatorTags[i]}[src$="${srcUrl}"] ${INITIATOR_TAG_HIDDEN_STYLE}\n`;
    }

    cosmeticApi.injectCss(code, tabId, requestFrameId);
}
