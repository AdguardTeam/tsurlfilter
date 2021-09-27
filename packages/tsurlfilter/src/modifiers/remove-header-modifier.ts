import { WebRequest } from 'webextension-polyfill-ts';
import { IAdvancedModifier } from './advanced-modifier';
import { removeHeader } from '../utils/headers';
import HttpHeaders = WebRequest.HttpHeaders;

/**
 * Headers filtering modifier class.
 * Rules with $removeheader modifier are intended to remove headers from HTTP requests and responses.
 */
export class RemoveHeaderModifier implements IAdvancedModifier {
    /**
     * List of forbidden headers
     */
    private static FORBIDDEN_HEADERS = [
        'access-control-allow-origin',
        'access-control-allow-credentials',
        'access-control-allow-headers',
        'access-control-allow-methods',
        'access-control-expose-headers',
        'access-control-max-age',
        'access-control-request-headers',
        'access-control-request-method',
        'origin',
        'timing-allow-origin',
        'allow',
        'cross-origin-embedder-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy',
        'content-security-policy',
        'content-security-policy-report-only',
        'expect-ct',
        'feature-policy',
        'origin-isolation',
        'strict-transport-security',
        'upgrade-insecure-requests',
        'x-content-type-options',
        'x-download-options',
        'x-frame-options',
        'x-permitted-cross-domain-policies',
        'x-powered-by',
        'x-xss-protection',
        'public-key-pins',
        'public-key-pins-report-only',
        'sec-websocket-key',
        'sec-websocket-extensions',
        'sec-websocket-accept',
        'sec-websocket-protocol',
        'sec-websocket-version',
        'p3p',
        'sec-fetch-mode',
        'sec-fetch-dest',
        'sec-fetch-site',
        'sec-fetch-user',
        'referrer-policy',
        'content-type',
        'content-length',
        'accept',
        'accept-encoding',
        'host',
        'connection',
        'transfer-encoding',
        'upgrade',
    ];

    /**
     * Request prefix
     */
    private static REQUEST_PREFIX = 'request:';

    /**
     * Prefixed headers are applied to request headers
     */
    private readonly isRequestModifier: boolean;

    /**
     * Effective header name to be removed
     */
    private readonly applicableHeaderName: string|null;

    /**
     * Value
     */
    private readonly value: string;

    /**
     * Constructor
     *
     * @param value
     * @param isAllowlist
     */
    constructor(value: string, isAllowlist: boolean) {
        this.value = value.toLowerCase();

        if (!isAllowlist && !this.value) {
            throw new SyntaxError('Invalid $removeheader rule, removeheader value must not be empty');
        }

        this.isRequestModifier = this.value.startsWith(RemoveHeaderModifier.REQUEST_PREFIX);
        const headerName = this.isRequestModifier
            ? this.value.substring(RemoveHeaderModifier.REQUEST_PREFIX.length) : this.value;

        this.applicableHeaderName = RemoveHeaderModifier.isAllowedHeader(headerName) ? headerName : null;
    }

    /**
     * Modifier value
     */
    public getValue(): string {
        return this.value;
    }

    /**
     * Applies modifier to headers collection
     *
     * @param headers
     * @param isRequestHeaders
     */
    public apply(headers: HttpHeaders, isRequestHeaders: boolean): boolean {
        if (!this.applicableHeaderName) {
            return false;
        }

        if (isRequestHeaders !== this.isRequestModifier) {
            return false;
        }

        return removeHeader(headers, this.applicableHeaderName);
    }

    /**
     * Some headers are forbidden to remove
     *
     * @param headerName
     */
    private static isAllowedHeader(headerName: string): boolean {
        return !this.FORBIDDEN_HEADERS.includes(headerName);
    }
}
