import { RequestType } from '@adguard/tsurlfilter';

import { tabsApi } from '../tabs';
import { requestContextStorage, RequestContext, RequestStorageEvent } from '../request';

export interface FrameRequestServiceSearchParams {
    tabId: number,
    frameId: number,
    requestUrl: string,
    requestType: RequestType,
}

export class FrameRequestService {
    public static start() {
        requestContextStorage.onRecord.subscribe(FrameRequestService.recordFrameRequestContext);
        requestContextStorage.onUpdate.subscribe(FrameRequestService.updateFrameRequestContext);
    }

    public static stop() {
        requestContextStorage.onRecord.unsubscribe(FrameRequestService.recordFrameRequestContext);
        requestContextStorage.onUpdate.unsubscribe(FrameRequestService.recordFrameRequestContext);
    }

    private static recordFrameRequestContext({ id, data }: RequestStorageEvent): void {
        const frame = tabsApi.getTabFrame(data.tabId, data.frameId);

        if (frame) {
            frame.requests.record(id, data);
        }
    }

    private static updateFrameRequestContext({ id, data }: RequestStorageEvent): void {
        const frame = tabsApi.getTabFrame(data.tabId, data.frameId);

        if (frame) {
            frame.requests.update(id, data);
        }
    }

    /**
     * Find request context in existing frames
     */
    public static search({
        tabId,
        frameId,
        requestUrl,
        requestType,
    }: FrameRequestServiceSearchParams): RequestContext | undefined {
        const frame = tabsApi.getTabFrame(tabId, frameId);

        if (frame) {
            return frame.requests.find(requestUrl, requestType);
        }
    }

    /**
     * Prepare search data, taking into account the fact
     * that the iframe may not have its own source url
     */
    public static prepareSearchParams(
        requestUrl: string,
        tabId: number,
        frameId: number,
    ): FrameRequestServiceSearchParams {
        const isMainFrame = frameId === 0;

        if ((requestUrl === 'about:blank'
            || requestUrl === 'about:srcdoc'
            // eslint-disable-next-line no-script-url
            || requestUrl.indexOf('javascript:') > -1)
            && !isMainFrame) {
            const mainFrame = tabsApi.getTabMainFrame(tabId);

            if (mainFrame) {
                return {
                    tabId,
                    frameId: 0,
                    requestUrl: mainFrame.url,
                    requestType: RequestType.Document,
                };
            }
        }

        const requestType = isMainFrame ? RequestType.Document : RequestType.Subdocument;

        return {
            tabId,
            frameId,
            requestUrl,
            requestType,
        };
    }
}
