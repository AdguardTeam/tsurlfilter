import { parse } from 'tldts';
import type { IResult } from 'tldts-core';

import { RequestType } from './request-type';

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
     * the request is for a given Hostname, and not for a URL, and we don't really know what protocol it is.
     * This can be true for DNS requests, or for HTTP CONNECT, or SNI matching.
     */
    public isHostnameRequest = false;

    /**
     * List of subdomains parsed from hostname
     */
    public subdomains: string[];

    /**
     * List of source subdomains parsed from source hostname
     */
    public sourceSubdomains: string[];

    /**
    * Splits subdomains and returns all subdomains (including the hostname itself)
    *
    * @param tldResult
    * @returns array of subdomains
    */
    private getSubdomains = (tldResult: IResult): string[] => {
        const { domain, hostname, subdomain } = tldResult;

        if (!domain) {
            if (hostname) {
                return [hostname];
            }
            return [];
        }

        const subdomainsResult = [domain];

        if (!subdomain) {
            return subdomainsResult;
        }

        const parts = subdomain.split('.');

        let incrementDomain = domain;
        for (let i = parts.length - 1; i >= 0; i -= 1) {
            incrementDomain = `${parts[i]}.${incrementDomain}`;
            subdomainsResult.push(incrementDomain);
        }

        return subdomainsResult;
    };

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
        this.subdomains = this.getSubdomains(tldResult);

        if (sourceUrl) {
            const sourceTldResult = parse(sourceUrl);
            this.sourceHostname = sourceTldResult.hostname!;
            this.sourceDomain = sourceTldResult.domain!;
            this.sourceSubdomains = this.getSubdomains(sourceTldResult);
        } else {
            this.sourceHostname = null;
            this.sourceDomain = null;
            this.sourceSubdomains = [];
        }

        if (this.sourceDomain) {
            this.thirdParty = this.domain !== this.sourceDomain;
        } else {
            this.thirdParty = null;
        }
    }
}
