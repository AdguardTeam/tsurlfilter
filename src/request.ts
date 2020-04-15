import { parse } from 'tldts';

/**
 * RequestType is the request types enumeration
 */
export enum RequestType {
    /** main frame */
    Document = 1,
    /** (iframe) $subdocument */
    Subdocument = 1 << 1,
    /** (javascript, etc) $script */
    Script = 1 << 2,
    /** (css) $stylesheet */
    Stylesheet = 1 << 3,
    /** (flash, etc) $object */
    Object = 1 << 4,
    /** (any image) $image */
    Image = 1 << 5,
    /** (ajax/fetch) $xmlhttprequest */
    XmlHttpRequest = 1 << 6,
    /** (video/music) $media */
    Media = 1 << 7,
    /** (any custom font) $font */
    Font = 1 << 8,
    /** (a websocket connection) $websocket */
    Websocket = 1 << 9,
    /** any other request type */
    Other = 1 << 10,
}

/**
 * Request represents a web request with all it's necessary properties
 */
export class Request {
    /**
     * Request type
     */
    public readonly requestType: RequestType;

    /**
     * True if request is third-party.
     * Third-party basically means that Domain != SourceDomain.
     * It can be null in the case when there is no sourceUrl at all.
     */
    public readonly thirdParty: boolean | null;

    /**
     * Original request URL.
     */
    public readonly url: string;

    /**
     * Request identifier
     */
    public requestId: number | undefined;

    /**
     * Status code
     */
    public statusCode: number | undefined;

    /**
     * Method name
     */
    public method: string | undefined;

    /**
     * Request tab identifier
     */
    public tabId: number | undefined;

    /**
     * The same request URL, but in lower case.
     * It is necessary to use lower-cased URL in several places,
     * that's why we keep it in the object.
     */
    public readonly urlLowercase: string;

    /**
     * Request's hostname
     */
    public readonly hostname: string;

    /**
     * Request's domain (eTLD+1)
     */
    public readonly domain: string;

    /**
     * Source URL. Can be empty.
     */
    public readonly sourceUrl: string | null;

    /**
     * Source hostname. Can be empty.
     */
    public readonly sourceHostname: string | null;

    /**
     * Source domain (eTLD+1). Can be empty.
     */
    public readonly sourceDomain: string | null;

    /**
     * Creates an instance of a Request
     *
     * @param url - request URL
     * @param sourceUrl - source URL
     * @param requestType - request type
     *
     * @throws
     */
    constructor(url: string, sourceUrl: string | null, requestType: RequestType) {
        this.url = url;
        this.urlLowercase = url.toLowerCase();
        this.sourceUrl = sourceUrl;
        this.requestType = requestType;

        const tldResult = parse(url);
        this.hostname = tldResult.hostname!;
        this.domain = tldResult.domain!;

        if (sourceUrl) {
            const sourceTldResult = parse(sourceUrl);
            this.sourceHostname = sourceTldResult.hostname!;
            this.sourceDomain = sourceTldResult.domain!;
        } else {
            this.sourceHostname = null;
            this.sourceDomain = null;
        }

        if (this.sourceDomain) {
            this.thirdParty = this.domain !== this.sourceDomain;
        } else {
            this.thirdParty = null;
        }
    }
}
