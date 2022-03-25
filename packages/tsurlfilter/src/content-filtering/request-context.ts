import { RequestType } from '../request-type';

export type RequestContext = {
    tab: {
        tabId: number;
    },
    requestId: string;
    requestUrl: string;
    engineRequestType: RequestType
    contentType: string | null;
    statusCode: number | null;
    method: string;
};
