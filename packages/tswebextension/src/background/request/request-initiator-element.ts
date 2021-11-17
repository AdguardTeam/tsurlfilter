import { RequestType } from '@adguard/tsurlfilter';

import { cosmeticApi } from '../cosmetic-api';

const enum InitiatorTag {
    FRAME = 'frame',
    IFRAME = 'iframe',
    IMAGE = 'img',
}

const initiatorTagHiddenStyle = '{ display: none!important; visibility: hidden!important; height: 0px!important; min-height: 0px!important; }';

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

export function hideRequestInitiatorElement(
    tabId: number, 
    requestFrameId: number,
    url: string,
    requestType: RequestType,
    isThirdParty: boolean,
) {

    const initiatorTags = getRequestInitiatorTag(requestType);

    if (!initiatorTags || tabId === -1) {
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
        code += `${initiatorTags[i]}[src$="${srcUrl}"] ${initiatorTagHiddenStyle}\n`;
    }

    cosmeticApi.injectCss(code, tabId, requestFrameId);
}
