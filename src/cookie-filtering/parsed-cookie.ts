import { parse } from 'tldts';

/**
 * Synthetic Cookie-like object parsed from headers
 */
export default class ParsedCookie {
    url: string;

    domain: string;

    name: string;

    value: string;

    expires?: Date;

    maxAge?: number;

    secure?: boolean;

    httpOnly?: boolean;

    sameSite?: string;

    thirdParty = false;

    constructor(name: string, value: string, url: string) {
        this.name = name;
        this.value = value;

        this.url = url;
        const tldResult = parse(url);
        this.domain = tldResult.domain!;
    }
}
