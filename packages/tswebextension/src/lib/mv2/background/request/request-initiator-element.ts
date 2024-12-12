import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { BACKGROUND_TAB_ID } from '../../../common/constants';
import { createHidingCssRule, AttributeMatching } from '../../common/hidden-style';
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

/**
 * Get relative path of first-party request for resource `src` attribute.
 *
 * @param requestUrl Resource url.
 * @param documentUrl Url of the document in which the resource will be loaded.
 *
 * @returns Relative path of resource `src` attribute for css selector.
 */
function getRelativeSrcPath(
    requestUrl: string,
    documentUrl: string,
): string {
    const requestUrlData = new URL(requestUrl);
    const documentUrlData = new URL(documentUrl);

    const documentPathname = documentUrlData.pathname;

    const requestPathname = requestUrlData.pathname;

    const requestUrlTail = requestUrlData.search + requestUrlData.hash;

    if (documentPathname === '/') {
        return requestPathname + requestUrlTail;
    }

    // Check that partial pathnames match

    const requestUrlPathParts = requestPathname.split('/').filter((part) => !!part);
    const documentUrlPathParts = documentPathname.split('/').filter((part) => !!part);

    const commonParts: string[] = [];

    for (let i = 0; i < Math.min(requestUrlPathParts.length, documentUrlPathParts.length); i += 1) {
        if (requestUrlPathParts[i] !== documentUrlPathParts[i]) {
            const path = requestUrlPathParts.slice(i).join('/') + requestUrlTail;
            // If first parts are matched, return path relative to document page
            // else return path relative to host
            return i > 0 ? path : `/${path}`;
        }

        commonParts.push(requestUrlPathParts[i]);
    }

    const commonPath = `/${commonParts.join('/')}`;

    return requestPathname.substring(commonPath.length + 1) + requestUrlTail;
}

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
 * @param requestUrl Request url.
 * @param documentUrl Document url.
 * @param requestType Request type.
 * @param isThirdParty Flag telling if request is third-party.
 */
export function hideRequestInitiatorElement(
    tabId: number,
    requestFrameId: number,
    requestUrl: string,
    documentUrl: string,
    requestType: RequestType,
    isThirdParty: boolean,
): void {
    const initiatorTags = getRequestInitiatorTag(requestType);

    if (!initiatorTags || tabId === BACKGROUND_TAB_ID) {
        return;
    }

    let src: string;
    let matching: AttributeMatching;

    if (isThirdParty) {
        src = requestUrl.substring(requestUrl.indexOf('//'));
        matching = AttributeMatching.Suffix;
    } else {
        src = getRelativeSrcPath(requestUrl, documentUrl);
        matching = AttributeMatching.Strict;
    }

    let code = '';

    for (let i = 0; i < initiatorTags.length; i += 1) {
        code += createHidingCssRule(initiatorTags[i], src, matching);
    }

    CosmeticApi.injectCss(tabId, requestFrameId, code);
}
