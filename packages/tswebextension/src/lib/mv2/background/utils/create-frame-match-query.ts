import { RequestType } from '@adguard/tsurlfilter/es/request-type';
import { MAIN_FRAME_ID } from '../tabs/frame';
import { isLocalFrame } from './is-local-frame';

import type { TabContext } from '../tabs/tab-context';
import { type MatchQuery } from '../../../common/interfaces';

/**
 * Creates match query for frame based on content script data and background tab context.
 * Used in {@link CosmeticApi} and {@link CookieFiltering} to match rules for content scripts.
 * @param frameUrl Frame url. Received from content script.
 * @param frameId Frame id. Received from content script.
 * @param tabContext Tab context. Received from background script.
 * @returns Match query for {@link EngineApi}.
 * @throws Error if tab context url is not defined.
 */
export function createFrameMatchQuery(
    frameUrl: string,
    frameId: number,
    tabContext: TabContext,
): MatchQuery {
    const { info } = tabContext;

    if (!info.url) {
        throw new Error('Tab url is required');
    }

    const mainFrameUrl = info.url;

    const isLocal = isLocalFrame(frameUrl, frameId, mainFrameUrl);

    const requestUrl = isLocal ? mainFrameUrl : frameUrl;

    let requestType: RequestType;

    // if frame is Local, then apply main frame rules.
    if (isLocal) {
        requestType = RequestType.Document;
    } else if (frameId === MAIN_FRAME_ID) {
        requestType = RequestType.Document;
    } else {
        requestType = RequestType.SubDocument;
    }

    return {
        requestUrl,
        frameUrl: requestUrl,
        requestType,
        frameRule: tabContext.mainFrameRule,
    };
}
