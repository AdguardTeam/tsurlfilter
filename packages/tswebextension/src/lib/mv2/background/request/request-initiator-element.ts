import { RequestType } from '@adguard/tsurlfilter/es/request-type';

import { BACKGROUND_TAB_ID } from '../../../common/constants';
import { AttributeMatching, createHidingCssRule } from '../../common/hidden-style';
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
 *
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

    // Generate CSS selectors to hide the blocked resource's initiator element.
    // We use two approaches to maximize compatibility:
    // 1. Suffix match with absolute URL (all requests): [src$="//domain/path"]
    // 2. Strict match with relative path (first-party only): [src="/path"]
    // This handles sites that use either relative or absolute URLs for same-domain resources.
    // See: https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3116

    let code = '';
    const absoluteSrc = requestUrl.substring(requestUrl.indexOf('//'));
    let relativeSrc: string | null = null;

    for (let i = 0; i < initiatorTags.length; i += 1) {
        const tag = initiatorTags[i];

        // Always use absolute URL with suffix matching
        code += createHidingCssRule(tag, absoluteSrc, AttributeMatching.Suffix);

        if (!isThirdParty) {
            // For first-party, also try relative path with strict matching
            // Cache the result to avoid redundant computation for multiple tags
            relativeSrc ??= getRelativeSrcPath(requestUrl, documentUrl);
            code += createHidingCssRule(tag, relativeSrc, AttributeMatching.Strict);
        }
    }

    CosmeticApi.injectCss(tabId, requestFrameId, code);
}
