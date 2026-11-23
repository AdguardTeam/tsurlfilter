// Part of the engine injected into pages: plain functions instead of a static class keep it small,
// see engine-entry.ts.
import { CanvasConditionType } from './constants';
import {
    type DocumentPolicyInput,
    type HostCondition,
    type PreparedCondition,
    type ProtectionPolicyArtifact,
} from './contracts';

/**
 * A predicate's result, or `undefined` when the hostname it needs is unknown.
 */
type Verdict = boolean | undefined;

/**
 * Reads the hostname of a URL.
 *
 * @param url Document URL or origin.
 *
 * @returns Lowercase hostname without a trailing dot, or `undefined` when the URL has none.
 */
const parseHostname = (url: string): string | undefined => {
    try {
        return new URL(url).hostname.replace(/\.$/, '') || undefined;
    } catch {
        return undefined;
    }
};

/**
 * Resolves the hostname that keys a site's noise with the extension's existing site-key rules.
 *
 * @param url Document URL or origin.
 *
 * @returns The complete hostname without `www.`, or `undefined` when the URL has none.
 */
export const resolveSiteKey = (url: string): string | undefined => (
    // The extension's getDomain() key for a URL with a hostname, without importing extension code
    // into the page engine.
    parseHostname(url)?.replace(/^www\./, '') || undefined
);

/**
 * Looks a hostname up in a host condition with set membership tests, so a long list
 * costs no regular expression with one alternative per entry.
 *
 * @param condition Host lookups prepared by the policy compiler.
 * @param hostname Hostname of the top-level document.
 *
 * @returns Whether any lookup matches.
 */
const matchHost = (condition: HostCondition, hostname: string): boolean => {
    const hosts = new Set(condition.hosts);
    // `www.` is stripped once, as frame matching does.
    const domain = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    if (hosts.has(hostname) || hosts.has(domain)) {
        return true;
    }
    const firstDot = domain.indexOf('.');
    if (firstDot > 0 && new Set(condition.parents).has(domain.slice(firstDot + 1))) {
        return true;
    }
    const domains = new Set(condition.domains);
    const labels = hostname.split('.');
    if (labels.some((label, index) => domains.has(labels.slice(index).join('.')))) {
        return true;
    }
    return condition.pattern !== undefined && new RegExp(condition.pattern).test(hostname);
};

/**
 * Evaluates a prepared condition against the hostname of a top-level document.
 *
 * @param condition Predicate prepared by the policy compiler.
 * @param hostname Hostname of the top-level document, if known.
 *
 * @returns Match, mismatch or `undefined` when the hostname is unknown.
 *
 * @throws When a trusted artifact contains an unexpected condition type.
 */
const evaluate = (condition: PreparedCondition, hostname: string | undefined): Verdict => {
    switch (condition.type) {
        case CanvasConditionType.Host:
            return hostname === undefined ? undefined : matchHost(condition, hostname);
        case CanvasConditionType.Not: {
            const verdict = evaluate(condition.operand, hostname);
            return verdict === undefined ? undefined : !verdict;
        }
        default:
            throw new Error('Unexpected prepared condition');
    }
};

/**
 * Decides whether a document is protected and which site keys its noise.
 * A child frame takes the site and the document exclusions of its top document,
 * so one page gets one noise and an excluded page stays native as a whole.
 * When the browser does not reveal the top document, the frame falls back to its own hostname.
 *
 * @param policy Trusted prepared exclusions.
 * @param input Synchronous facts about the document.
 *
 * @returns The hostname keying the noise, or `undefined` for an excluded document and one without a hostname.
 */
export const resolveProtectedSite = (
    policy: ProtectionPolicyArtifact,
    input: DocumentPolicyInput,
): string | undefined => {
    const { url, topUrl } = input;
    const topHostname = topUrl === undefined ? undefined : parseHostname(topUrl);
    // Unknown verdicts do not exclude, so a top document without a hostname is never excluded.
    if (policy.documentExclusions.some((condition) => evaluate(condition, topHostname) === true)) {
        return undefined;
    }
    return (topUrl === undefined ? undefined : resolveSiteKey(topUrl)) ?? resolveSiteKey(url);
};
