import { RequestContext } from '../request';

export class Frame {
    url: string | undefined;

    requestContext: RequestContext | undefined;

    constructor(url?: string, requestContext?: RequestContext) {
        this.url = url;
        this.requestContext = requestContext;
    }
}
