import { WebRequest } from 'webextension-polyfill';
import { CosmeticResult, CosmeticRule } from '@adguard/tsurlfilter';
import {
    type RequestContext,
    requestContextStorage,
} from '../request/request-context-storage';

/**
 * CSP Trusted Types service module.
 */
export class TrustedTypesService {
    private static readonly SPACE = ' ';

    private static readonly CSP_DIRECTIVE_VALUES_SEPARATOR = TrustedTypesService.SPACE;

    private static readonly CSP_DIRECTIVES_SEPARATOR = ';';

    /**
     * Content Security Policy header name.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy}
     */
    private static readonly CSP_HEADER_NAME = 'content-security-policy';

    /**
     * Content Security Policy Report-Only header name.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only}
     */
    private static readonly CSP_REPORT_ONLY_HEADER_NAME = 'content-security-policy-report-only';

    /**
     * TrustedTypes directive.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/trusted-types}
     */
    private static readonly CSP_TRUSTED_TYPES_DIRECTIVE_NAME = 'trusted-types';

    /**
     * TrustedTypes directive value that disallows creating any trusted types policy.
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/trusted-types}
     */
    private static readonly NONE_TRUSTED_TYPES_POLICY_VALUE = "'none'";

    /**
     * Allows for creating Trusted Types policies with a name that was already used.
     *
     * Related:
     *
     *
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/trusted-types}
     */
    private static readonly ALLOW_DUPLICATES_POLICY_VALUE = "'allow-duplicates'";

    /**
     * Trusted Types policy name for AdGuard scripts.
     *
     * Related issues:
     * {@link https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2068 | #2068},
     * AG-3320,
     * AG-18204.
     */
    private static readonly AG_POLICY_NAME = 'AGPolicy';

    /**
     * Checks whether the CSP header should be modified at all.
     * It is required if there are any scriptlet rules in the cosmetic result.
     *
     * Important: trusted types policy with name `AGPolicy` is being created only in scriptlets now,
     * so if some other dependency will do the same — this method should be updated.
     *
     * @param cosmeticResult Cosmetic result.
     *
     * @returns True if the CSP header should be modified, false otherwise.
     */
    private static isModifyingRequired(cosmeticResult: CosmeticResult): boolean {
        const scriptRules = cosmeticResult.getScriptRules();
        if (scriptRules.length === 0) {
            return false;
        }
        // simply check if there are any scriptlet rules
        return scriptRules.some((rule) => rule.isScriptlet);
    }

    /**
     * Checks whether the header is a CSP header.
     * CSP headers are `Content-Security-Policy` and `Content-Security-Policy-Report-Only`.
     *
     * @param header Header.
     *
     * @returns True if the header is a CSP header, false otherwise.
     */
    private static isCspHeader(header: WebRequest.HttpHeadersItemType): boolean {
        // header names are case-insensitive
        // https://datatracker.ietf.org/doc/html/rfc2616#section-4.2
        return header.name.toLowerCase() === TrustedTypesService.CSP_HEADER_NAME
            || header.name.toLowerCase() === TrustedTypesService.CSP_REPORT_ONLY_HEADER_NAME;
    }

    /**
     * Modifies the value of CSP directive:
     * 1. if there are no `value` or if `value` contains only `'none'` —
     *    returns `AGPolicy` and `'allow-duplicates'` combined;
     * 2. otherwise — adds `AGPolicy` and `'allow-duplicates'` to the directive value.
     *
     * @param value CSP directive value.
     *
     * @returns CSP directive value.
     */
    private static modifyDirectiveValue(value: string): string {
        const valueChunks = value
            .split(TrustedTypesService.CSP_DIRECTIVE_VALUES_SEPARATOR)
            .map((chunk) => chunk.trim())
            .filter((chunk) => !!chunk);

        const modifiedValueChunks: string[] = [];

        if (valueChunks.length > 0
            && !valueChunks.includes(TrustedTypesService.NONE_TRUSTED_TYPES_POLICY_VALUE)) {
            // copy `trusted-types` policy names from the directive value
            modifiedValueChunks.push(...valueChunks);
        }

        // add `AGPolicy` to the directive value if there is no such policy yet
        if (!modifiedValueChunks.includes(TrustedTypesService.AG_POLICY_NAME)) {
            modifiedValueChunks.push(TrustedTypesService.AG_POLICY_NAME);
        }

        // make sure that `'allow-duplicates'` is present
        if (!modifiedValueChunks.includes(TrustedTypesService.ALLOW_DUPLICATES_POLICY_VALUE)) {
            modifiedValueChunks.push(TrustedTypesService.ALLOW_DUPLICATES_POLICY_VALUE);
        }

        return modifiedValueChunks.join(TrustedTypesService.CSP_DIRECTIVE_VALUES_SEPARATOR);
    }

    /**
     * Modifies CSP header — checks whether it has a `trusted-types` directive,
     * and if so — adds `AGPolicy` and `'allow-duplicates'` to the directive value if needed.
     *
     * @param header Content Security Policy header.
     *
     * @returns Modified header.
     */
    static modifyCspHeader(header: WebRequest.HttpHeadersItemType): WebRequest.HttpHeadersItemType {
        const { value } = header;
        if (!value) {
            return header;
        }

        const directives = value.split(TrustedTypesService.CSP_DIRECTIVES_SEPARATOR);
        const resultDirectives: string[] = [];

        for (let i = 0; i < directives.length; i += 1) {
            const directive = directives[i].trim();
            if (!directive) {
                continue;
            }
            const separatorIndex = directive.indexOf(TrustedTypesService.CSP_DIRECTIVE_VALUES_SEPARATOR);
            const directiveName = separatorIndex === -1
                ? directive
                : directive.slice(0, separatorIndex);

            if (directiveName !== TrustedTypesService.CSP_TRUSTED_TYPES_DIRECTIVE_NAME) {
                // do nothing if it is not a `trusted-types` directive
                resultDirectives.push(directive);
                continue;
            }

            const directiveValue = separatorIndex === -1
                ? ''
                : directive.slice(separatorIndex + 1);

            const modifiedDirectiveValue = TrustedTypesService.modifyDirectiveValue(directiveValue);
            resultDirectives.push(
                `${directiveName}${TrustedTypesService.CSP_DIRECTIVE_VALUES_SEPARATOR}${modifiedDirectiveValue}`,
            );
        }

        return {
            name: header.name,
            // eslint-disable-next-line max-len
            value: `${resultDirectives.join(`${TrustedTypesService.CSP_DIRECTIVES_SEPARATOR}${TrustedTypesService.SPACE}`)}`,
        };
    }

    /**
     * Modifies CSP header of response headers —
     * adds `AGPolicy` and `'allow-duplicates'` to CSP header if there is a `trusted-types` directive,
     * and returns modified headers.
     *
     * It happens only if `context.cosmeticResult` contain any scriptlets.
     *
     * It is applied when webRequest.onHeadersReceived event is fired.
     *
     * @param context Request context.
     *
     * @returns True if headers were modified.
     */
    public static onHeadersReceived(context: RequestContext): boolean {
        const { responseHeaders, cosmeticResult } = context;

        if (!responseHeaders || responseHeaders.length === 0) {
            return false;
        }
        // no need to modify CSP header if there is no cosmetic result
        if (!cosmeticResult) {
            return false;
        }

        if (!TrustedTypesService.isModifyingRequired(cosmeticResult)) {
            return false;
        }

        const anyCspHeaders: WebRequest.HttpHeaders = [];
        const notCspHeaders: WebRequest.HttpHeaders = [];
        responseHeaders.forEach((header) => {
            // separate CSP headers from others
            if (TrustedTypesService.isCspHeader(header)) {
                anyCspHeaders.push(header);
            } else {
                notCspHeaders.push(header);
            }
        });

        // nothing to do if there are no CSP headers
        if (anyCspHeaders.length === 0) {
            return false;
        }

        // flag that indicates whether any of CSP header value was modified
        let isModified = false;

        const modifiedCspHeaders: WebRequest.HttpHeaders = [];
        anyCspHeaders.forEach((header) => {
            const modifiedHeader = TrustedTypesService.modifyCspHeader(header);
            // check if header value was modified
            if (modifiedHeader.value !== header.value) {
                isModified = isModified || true;
            }
            modifiedCspHeaders.push(modifiedHeader);
        });

        if (!isModified) {
            return false;
        }

        requestContextStorage.update(context.requestId, {
            responseHeaders: [
                ...notCspHeaders,
                ...modifiedCspHeaders,
            ],
        });

        return true;
    }
}
