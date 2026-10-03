import { getDomain } from '../utils/url';

import {
    type DocumentPolicyInput,
    type PreparedCondition,
    type PreparedPolicyRule,
    type ProtectionPolicyArtifact,
} from './contracts';

/**
 * A predicate's result, or `undefined` when a URL it needs is unknown.
 */
type Verdict = boolean | undefined;

/**
 * URLs a predicate can read, by its input selector.
 */
type PredicateUrls = Record<Extract<PreparedCondition, { type: 'url-regexp' }>['input'], string | undefined>;

/**
 * Resolves the hostname that keys a site's noise with the extension's existing site-key rules.
 *
 * @param url Document URL or origin.
 *
 * @returns The complete hostname without `www.`, or `undefined` when the URL has none.
 */
export const resolveSiteKey = (url: string): string | undefined => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return undefined;
    }
    if (!parsed.hostname) {
        return undefined;
    }
    // The shared helper's first-colon extraction cannot represent IPv6 or credential authorities.
    const needsCompleteHost = parsed.hostname.startsWith('[') || !!parsed.username || !!parsed.password;
    const hostname = needsCompleteHost ? parsed.hostname.replace(/\.$/, '').replace(/^www\./, '')
        : getDomain(parsed.href);
    return hostname || undefined;
};

/**
 * Combines three-state verdicts without treating an unknown one as false.
 *
 * @param verdicts Operand verdicts.
 * @param decisive The value that decides the result alone: `true` for "or", `false` for "and".
 *
 * @returns The decided value, or `undefined` when only an unknown operand could decide it.
 */
const combine = (verdicts: readonly Verdict[], decisive: boolean): Verdict => {
    if (verdicts.includes(decisive)) {
        return decisive;
    }
    return verdicts.includes(undefined) ? undefined : !decisive;
};

/**
 * Evaluates a prepared condition against the URLs known for a document.
 *
 * @param condition Predicate prepared by the policy producer.
 * @param urls URLs the predicate inputs select.
 *
 * @returns Match, mismatch or `undefined` when a required URL is unknown.
 *
 * @throws When a trusted artifact contains an unexpected condition type.
 */
const evaluate = (condition: PreparedCondition, urls: PredicateUrls): Verdict => {
    switch (condition.type) {
        case 'unavailable':
            return undefined;
        case 'url-regexp': {
            const url = urls[condition.input];
            return url === undefined ? undefined : new RegExp(condition.pattern, condition.flags).test(url);
        }
        case 'and':
        case 'or':
            return combine(condition.operands.map((operand) => evaluate(operand, urls)), condition.type === 'or');
        case 'not': {
            const verdict = evaluate(condition.operand, urls);
            return verdict === undefined ? undefined : !verdict;
        }
        default:
            throw new Error('Unexpected prepared condition');
    }
};

/**
 * Tells whether a rule of the given request type certainly matches.
 *
 * @param rules Prepared exclusions with request type masks.
 * @param requestType Kind of the document the rules are evaluated for.
 * @param urls URLs the predicate inputs select.
 *
 * @returns Whether the document is excluded. Unknown verdicts do not exclude.
 */
const isExcluded = (
    rules: readonly PreparedPolicyRule[],
    requestType: DocumentPolicyInput['requestType'],
    urls: PredicateUrls,
): boolean => combine(
    rules.filter((rule) => rule.requestTypes.includes(requestType)).map((rule) => evaluate(rule.condition, urls)),
    true,
) === true;

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
    const { url, topUrl, sourceUrl } = input;
    // A top document is its own top and source.
    const own: PredicateUrls = { 'frame-url': url, 'top-url': topUrl, 'source-url': sourceUrl };
    const top: PredicateUrls = { 'frame-url': topUrl, 'top-url': topUrl, 'source-url': topUrl };
    if (isExcluded(policy.ownFrameExclusions, input.requestType, own)
        || isExcluded(policy.documentExclusions, 'document', top)) {
        return undefined;
    }
    return (topUrl === undefined ? undefined : resolveSiteKey(topUrl)) ?? resolveSiteKey(url);
};
