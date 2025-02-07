import { type IAdvancedModifier } from './advanced-modifier';

/**
 * Headers filtering modifier class.
 * Rules with $removeheader modifier are intended to remove headers from HTTP requests and responses.
 */
export class RemoveHeaderModifier implements IAdvancedModifier {
    /**
     * List of forbidden headers.
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
     * Request prefix.
     */
    private static REQUEST_PREFIX = 'request:';

    /**
     * Prefixed headers are applied to request headers.
     */
    private readonly isRequestModifier: boolean;

    /**
     * Effective header name to be removed.
     */
    private readonly applicableHeaderName: string | null;

    /**
     * Value.
     */
    private readonly value: string;

    /**
     * Is rule valid or not.
     */
    private readonly valid: boolean;

    /**
     * Constructor.
     *
     * @param value Value of the modifier.
     * @param isAllowlist Whether the rule is an allowlist rule or not.
     */
    constructor(value: string, isAllowlist: boolean) {
        this.value = value.toLowerCase();

        if (!isAllowlist && !this.value) {
            throw new SyntaxError('Invalid $removeheader rule, removeheader value must not be empty');
        }

        this.isRequestModifier = this.value.startsWith(RemoveHeaderModifier.REQUEST_PREFIX);
        const headerName = this.isRequestModifier
            ? this.value.substring(RemoveHeaderModifier.REQUEST_PREFIX.length)
            : this.value;

        // Values with ":" are not supported in MV3 declarative rules, e.g. "$removeheader=dnt:1"
        this.valid = RemoveHeaderModifier.isAllowedHeader(headerName) && !headerName.includes(':');
        this.applicableHeaderName = this.valid ? headerName : null;
    }

    /**
     * Modifier value.
     *
     * @returns The value of the modifier.
     */
    public getValue(): string {
        return this.value;
    }

    /**
     * Modifier validity.
     *
     * @returns True if the rule is valid, false otherwise.
     */
    public get isValid(): boolean {
        return this.valid;
    }

    /**
     * Checks if the given modifier is an instance of RemoveHeaderModifier.
     *
     * @param m The modifier to check.
     *
     * @returns True if the modifier is an instance of RemoveHeaderModifier, false otherwise.
     */
    public static isRemoveHeaderModifier = (m: IAdvancedModifier): m is RemoveHeaderModifier => {
        return m instanceof RemoveHeaderModifier;
    };

    /**
     * Returns effective header name to be removed.
     *
     * @param isRequestHeaders Flag to determine that the header is a *request* header,
     * otherwise *response* header.
     *
     * @returns The applicable header name if valid, otherwise null.
     */
    public getApplicableHeaderName(isRequestHeaders: boolean): string | null {
        if (!this.applicableHeaderName) {
            return null;
        }

        if (isRequestHeaders !== this.isRequestModifier) {
            return null;
        }

        return this.applicableHeaderName;
    }

    /**
     * Some headers are forbidden to remove.
     *
     * @param headerName Header name to check.
     *
     * @returns True if the header is allowed to be removed, false otherwise.
     */
    private static isAllowedHeader(headerName: string): boolean {
        return !this.FORBIDDEN_HEADERS.includes(headerName);
    }
}
