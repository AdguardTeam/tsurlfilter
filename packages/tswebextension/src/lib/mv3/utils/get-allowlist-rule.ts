import {
    MODIFIER_ASSIGN_OPERATOR,
    MODIFIERS_SEPARATOR,
    NETWORK_RULE_EXCEPTION_MARKER,
    NETWORK_RULE_SEPARATOR,
    PIPE_MODIFIER_SEPARATOR,
} from '@adguard/agtree';
import { NETWORK_RULE_OPTIONS } from '@adguard/tsurlfilter';

/**
 * Creates allowlist rule for domains list.
 *
 * @param domains Domains to create allowlist rule for.
 *
 * @returns Allowlist rule for given domains or empty string if domains list is empty.
 *
 * @example
 * ```
 * const domains1 = ['example.com', 'example.org']
 * getAllowlistRule(domains1) -> '@@$document,to=example.com|example.org'
 *
 * const domains2 = []
 * getAllowlistRule(domains2) -> ''
 * ```
 */
export const getAllowlistRule = (domains: string[]): string => {
    if (domains.length === 0) {
        return '';
    }

    const concatenatedUniqueDomains = Array.from(new Set(domains)).join(PIPE_MODIFIER_SEPARATOR);
    // e.g. '@@$document,to=example.com|example.org'
    return [
        NETWORK_RULE_EXCEPTION_MARKER,
        NETWORK_RULE_SEPARATOR,
        NETWORK_RULE_OPTIONS.DOCUMENT,
        MODIFIERS_SEPARATOR,
        NETWORK_RULE_OPTIONS.TO,
        MODIFIER_ASSIGN_OPERATOR,
        concatenatedUniqueDomains,
    ].join('');
};
