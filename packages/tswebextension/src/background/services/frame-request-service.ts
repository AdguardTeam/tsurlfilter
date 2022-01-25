import { RequestType } from '@adguard/tsurlfilter';

import { tabsApi } from '../tabs';
import { requestContextStorage, RequestContext } from '../request';
import { EventChannelListener } from '../utils';

export interface FrameRequestServiceSearchParams {
    tabId: number,
    frameId: number,
    requestUrl: string,
    requestType: RequestType,
}

export class FrameRequestService {
    public start() {
        requestContextStorage.onRecord.subscribe(this.recordFrameRequestContext as EventChannelListener);
        requestContextStorage.onUpdate.subscribe(this.updateFrameRequestContext as EventChannelListener);
    }

    public stop() {
        requestContextStorage.onRecord.unsubscribe(this.recordFrameRequestContext as EventChannelListener);
        requestContextStorage.onUpdate.unsubscribe(this.recordFrameRequestContext as EventChannelListener);
    }

    private recordFrameRequestContext(requestId: string, data: RequestContext): void {
        const frame = tabsApi.getTabFrame(data.tabId, data.frameId);

        if (frame) {
            frame.requests.record(requestId, data);
        }

    }

    private updateFrameRequestContext(requestId: string, data: RequestContext): void {
        const frame = tabsApi.getTabFrame(data.tabId, data.frameId);

        if (frame) {
            frame.requests.update(requestId, data);
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


export const frameRequestService = new FrameRequestService();