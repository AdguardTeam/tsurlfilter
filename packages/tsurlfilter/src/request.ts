import { parse } from 'tldts';
import type { IResult } from 'tldts-core';

import { type HTTPMethod } from './modifiers/method-modifier';
import { type RequestType } from './request-type';
import { isHttpOrWsRequest } from './utils/url';

/**
 * Request represents a web request with all it's necessary properties.
 */
export class Request {
    /**
     * Max url length for matching
     * Some urls are really long and slow down matching, so we cut them to this length.
     */
    public static readonly MAX_URL_MATCH_LENGTH = 2000;

    /**
     * Request type.
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
     * Request identifier.
     */
    public requestId: number | undefined;

    /**
     * Status code.
     */
    public statusCode: number | undefined;

    /**
     * Method name.
     */
    public method: HTTPMethod | undefined;

    /**
     * Request tab identifier.
     */
    public tabId: number | undefined;

    /**
     * The same request URL, but in lower case and shortened.
     * It is necessary to use lower-cased URL in several places,
     * that's why we keep it in the object.
     */
    public readonly urlLowercase: string;

    /**
     * Request's hostname.
     */
    public readonly hostname: string;

    /**
     * Request's domain (eTLD+1).
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
     * The request is for a given Hostname, and not for a URL, and we don't really know what protocol it is.
     * This can be true for DNS requests, or for HTTP CONNECT, or SNI matching.
     */
    public isHostnameRequest = false;

    /**
     * List of subdomains parsed from hostname.
     */
    public subdomains: string[];

    /**
     * List of source subdomains parsed from source hostname.
     */
    public sourceSubdomains: string[];

    /**
     * List of client tags.
     */
    public clientTags: string[] | undefined;

    /**
     * DNS type.
     */
    public dnsType: string | undefined;

    /**
     * Client name.
     */
    public clientName: string | undefined;

    /**
     * Client IP.
     */
    public clientIP: string | undefined;

    /**
     * Creates an instance of a Request.
     *
     * @param url Request URL.
     * @param sourceUrl Source URL.
     * @param requestType Request type.
     * @param method Request method.
     *
     * @throws
     */
    constructor(url: string, sourceUrl: string | null, requestType: RequestType, method?: HTTPMethod) {
        if (typeof url !== 'string' || !isHttpOrWsRequest(url)) {
            throw new TypeError(`Invalid request url: ${url}`);
        }

        this.url = url;
        this.requestType = requestType;
        this.method = method;

        this.urlLowercase = Request.compactUrl(url)!.toLowerCase();
        this.sourceUrl = Request.compactUrl(sourceUrl);

        const tldResult = Request.parse(url);

        // We suppose that request always has a hostname and a domain.
        this.hostname = tldResult.hostname!;
        this.domain = tldResult.domain!;
        this.subdomains = Request.getSubdomains(tldResult);

        let sourceTldResult;
        if (sourceUrl) {
            sourceTldResult = Request.parse(sourceUrl);

            this.sourceHostname = sourceTldResult.hostname!;
            this.sourceDomain = sourceTldResult.domain!;
            this.sourceSubdomains = Request.getSubdomains(sourceTldResult);
        } else {
            this.sourceHostname = null;
            this.sourceDomain = null;
            this.sourceSubdomains = [];
        }

        if (this.sourceDomain) {
            this.thirdParty = this.domain !== this.sourceDomain;
        } else if (sourceTldResult && sourceTldResult.isIp) {
            this.thirdParty = this.hostname !== this.sourceHostname;
        } else {
            this.thirdParty = null;
        }
    }

    /**
     * Parses URL using tldts and fallbacks to URL API if needed.
     *
     * @param url The URL to be parsed.
     *
     * @returns The parsed URL result.
     */
    private static parse(url: string): IResult {
        const tldResult = parse(url);

        /**
         * Tldts may fail to parse certain IPv6 hostnames (e.g., [::]),
         * so we fall back to the URL API as a workaround.
         *
         * @see https://github.com/AdguardTeam/AdguardBrowserExtension/issues/3360
         */
        if (!tldResult.hostname) {
            try {
                const u = new URL(url);
                tldResult.hostname = u.hostname;
            } catch (e) {
                // ignore
            }
        }

        return tldResult;
    }

    /**
     * We cut the url in performance purposes.
     *
     * @param url The URL to be compacted.
     *
     * @returns The compacted URL or null if the input URL is null.
     */
    private static compactUrl(url: string | null): string | null {
        let compacted = url;
        if (compacted && compacted.length > Request.MAX_URL_MATCH_LENGTH) {
            compacted = compacted.substring(0, Request.MAX_URL_MATCH_LENGTH);
        }

        return compacted;
    }

    /**
     * Splits subdomains and returns all subdomains (including the hostname itself).
     *
     * @param tldResult Result of `tldts.parse()`.
     *
     * @returns Array of subdomains.
     */
    private static getSubdomains(tldResult: IResult): string[] {
        const {
            domain,
            hostname,
            subdomain,
            publicSuffix,
        } = tldResult;

        const subdomainsResult = [];

        if (!domain) {
            if (hostname) {
                subdomainsResult.push(hostname);
                return subdomainsResult;
            }
            return [];
        }

        if (publicSuffix) {
            subdomainsResult.push(publicSuffix);
            // Extract subdomains from complex suffixes
            // https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2037
            // https://github.com/AdguardTeam/tsurlfilter/issues/57
            for (let i = 0; i < publicSuffix.length; i += 1) {
                if (publicSuffix[i] === '.') {
                    subdomainsResult.push(publicSuffix.slice(i + 1));
                }
            }
        }

        subdomainsResult.push(domain);

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
    }
}
