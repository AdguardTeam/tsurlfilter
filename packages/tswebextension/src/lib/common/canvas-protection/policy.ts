// Part of the engine injected into pages: plain functions instead of a static class keep it small,
// see engine-entry.ts.
import { CanvasConditionType } from './constants';
import { type DocumentPolicyInput, type PreparedCondition, type ProtectionPolicyArtifact } from './contracts';

/**
 * A predicate's result, or `undefined` when the URL it needs is unknown.
 */
type Verdict = boolean | undefined;

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
    // Same key as the extension's getDomain(), without importing extension code into the page engine.
    return parsed.hostname.replace(/\.$/, '').replace(/^www\./, '') || undefined;
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
 * Evaluates a prepared condition against the URL of a top-level document.
 *
 * @param condition Predicate prepared by the policy compiler.
 * @param url URL of the top-level document, if known.
 *
 * @returns Match, mismatch or `undefined` when the URL is unknown.
 *
 * @throws When a trusted artifact contains an unexpected condition type.
 */
const evaluate = (condition: PreparedCondition, url: string | undefined): Verdict => {
    switch (condition.type) {
        case CanvasConditionType.UrlRegexp:
            return url === undefined ? undefined : new RegExp(condition.pattern, condition.flags).test(url);
        case CanvasConditionType.And:
        case CanvasConditionType.Or:
            return combine(
                condition.operands.map((operand) => evaluate(operand, url)),
                condition.type === CanvasConditionType.Or,
            );
        case CanvasConditionType.Not: {
            const verdict = evaluate(condition.operand, url);
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
    // Unknown verdicts do not exclude.
    if (combine(policy.documentExclusions.map((condition) => evaluate(condition, topUrl)), true) === true) {
        return undefined;
    }
    return (topUrl === undefined ? undefined : resolveSiteKey(topUrl)) ?? resolveSiteKey(url);
};
