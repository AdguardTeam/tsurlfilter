/**
 * Http headers item type represents incoming response headers.
 * To be used for headers matching
 */
export type HttpHeadersItem = {
    /**
     * Name of the HTTP header.
     */
    name: string;

    /**
     * Value of the HTTP header if it can be represented by UTF-8.
     */
    value?: string;
};

export type HttpHeaderMatcher = {
    /**
     * Name of the HTTP header.
     */
    header: string;

    /**
     * HTTP header value matcher.
     */
    value?: string | RegExp | null;
};

/**
 * Header modifier class.
 * The $header modifier allows matching the HTTP response
 * by a specific header with (optionally) a specific value.
 *
 * Learn more about it here:
 * https://adguard.com/kb/general/ad-filtering/create-own-filters/#header-modifier
 */
export class HeaderModifier {
    /**
     * Colon separator.
     */
    private readonly COLON_SEPARATOR = ':';

    /**
     * Forward slash regexp marker.
     */
    private readonly FORWARD_SLASH = '/';

    /**
     * Header name to match on request.
     */
    public readonly header: string;

    /**
     * Header value to match on request.
     * Empty string if value is not specified, and, in that case,
     * only header name will be matched.
     */
    public readonly value: string | RegExp | null;

    /**
     * Constructor
     * @param headerStr Header modifier value.
     */
    constructor(headerStr: string) {
        if (headerStr === '') {
            throw new SyntaxError('$header modifier value cannot be empty');
        }

        const separatorIndex = headerStr.indexOf(this.COLON_SEPARATOR);

        if (separatorIndex === -1) {
            this.header = headerStr;
            this.value = null;
            return;
        }

        this.header = headerStr.slice(0, separatorIndex);

        const rawValue = headerStr.slice(separatorIndex + 1);
        if (rawValue === '') {
            throw new SyntaxError(`Invalid $header modifier value: "${headerStr}"`);
        }

        if (rawValue.startsWith(this.FORWARD_SLASH) && rawValue.endsWith(this.FORWARD_SLASH)) {
            this.value = new RegExp(rawValue.slice(1, -1));
        } else {
            this.value = rawValue;
        }
    }

    /**
     * Returns header modifier value
     * @returns header modifier value
     */
    public getHeaderModifierValue(): HttpHeaderMatcher {
        return {
            header: this.header,
            value: this.value,
        };
    }
}
