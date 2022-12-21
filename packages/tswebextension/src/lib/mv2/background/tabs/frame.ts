import { RequestContext } from '../request';

/**
 * Class for storing frame url and request context.
 */
export class Frame {
    url: string | undefined;

    requestContext: RequestContext | undefined;

    /**
     * Constructor for the Frame class.
     *
     * @param url Frame url.
     * @param requestContext Request context.
     */
    constructor(url?: string, requestContext?: RequestContext) {
        this.url = url;
        this.requestContext = requestContext;
    }
}
