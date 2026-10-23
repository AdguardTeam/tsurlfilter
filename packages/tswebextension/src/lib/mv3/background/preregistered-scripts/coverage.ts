import { type CosmeticRule } from '@adguard/tsurlfilter';

import { logger } from '../../../common/utils/logger';
import { isHttpRequest } from '../../../common/utils/url';
import { type FrameMV3 } from '../../tabs/frame';
import { appContext } from '../app-context';

import { computeRuleHashCached } from './hasher';

/**
 * Looks up a frame context by tab and frame id.
 */
export type FrameContextLookup = (tabId: number, frameId: number) => FrameMV3 | undefined;

/**
 * Rules whose hash failure has already been logged. Hashing failures are
 * deterministic and this filter runs per frame, so without the set one
 * broken rule would re-log on every frame of every covered host.
 */
const loggedHashFailures = new WeakSet<CosmeticRule>();

/**
 * Resolves the hostname whose preregistered coverage applies to a frame.
 * Opaque frames (`about:blank`, srcdoc) have no own host: their coverage
 * comes from the nearest HTTP(S) ancestor, mirroring the
 * `matchOriginAsFallback: true` semantics of preregistered registrations.
 *
 * @param tabId Tab id.
 * @param frameContext Frame context to resolve the host for.
 * @param getFrameContext Injected frame lookup.
 *
 * @returns Lower-cased hostname or `null` when no HTTP ancestor exists.
 */
export const resolveCoverageHost = (
    tabId: number,
    frameContext: FrameMV3,
    getFrameContext: FrameContextLookup,
): string | null => {
    const visited = new Set<number>();
    let current: FrameMV3 | undefined = frameContext;

    while (current) {
        if (isHttpRequest(current.url)) {
            try {
                const { hostname } = new URL(current.url);
                return hostname ? hostname.toLowerCase() : null;
            } catch {
                return null;
            }
        }

        // Guard against broken parent chains (partially recorded frame
        // contexts) looping forever.
        if (visited.has(current.frameId)) {
            return null;
        }
        visited.add(current.frameId);

        current = current.parentFrameId >= 0
            ? getFrameContext(tabId, current.parentFrameId)
            : undefined;
    }

    return null;
};

/**
 * Returns the hashes of preregistered rules covered by the registrations
 * that apply to the frame — those dynamic injection must skip.
 *
 * @param tabId Tab id.
 * @param frameContext Frame context.
 * @param getFrameContext Injected frame lookup.
 * @param preExistingDocument Whether the document loaded before the current
 * service worker started: such a document is judged only against the rules
 * from registrations persisted at boot, since a registration updated since
 * then may carry rules the page never received.
 *
 * @returns Covered rule hashes or `undefined` when there is no coverage.
 */
export const getCoveredRules = (
    tabId: number,
    frameContext: FrameMV3,
    getFrameContext: FrameContextLookup,
    preExistingDocument = false,
): ReadonlySet<string> | undefined => {
    const coveredRules = preExistingDocument
        ? appContext.preregisteredScriptRulesAtBoot
        : appContext.preregisteredScriptRules;

    if (!coveredRules || coveredRules.size === 0) {
        return undefined;
    }

    const host = resolveCoverageHost(tabId, frameContext, getFrameContext);
    if (!host) {
        return undefined;
    }

    return coveredRules.get(host);
};

/**
 * Filters out the rules covered by preregistered content scripts, keeping
 * those dynamic injection must still deliver.
 *
 * Rules that fail to hash keep the dynamic injection path — their coverage
 * cannot be established. Split coverage can reorder same-domain rules
 * relative to each other (bundle runs at document_start, dynamic injection
 * later) — accepted: rule execution order is not a contract anywhere on the
 * dynamic path.
 *
 * In a non-HTTP frame (`about:blank`, srcdoc, blob:) `$path`-qualified
 * rules always stay on the dynamic path: the frame receives them by
 * copying the nearest HTTP ancestor's result (where the `$path` condition
 * was evaluated against the ancestor's URL), while the per-rule guard in the
 * preregistered file cannot evaluate that URL from the frame and never
 * executes them there. Treating them as covered would lose the rule on both
 * paths.
 *
 * @param rawRules Candidate rules to filter.
 * @param coveredRules Hashes of rules covered by preregistered registrations.
 * @param frameUrl Frame URL, used for logging and to detect non-HTTP frames.
 *
 * @returns Rules not covered by preregistered content scripts.
 */
export const filterUncoveredRules = async (
    rawRules: CosmeticRule[],
    coveredRules: ReadonlySet<string>,
    frameUrl: string,
): Promise<CosmeticRule[]> => {
    const isHttpFrame = isHttpRequest(frameUrl);

    const results = await Promise.all(rawRules.map(async (rule) => {
        // The preregistered per-rule guard only sees the frame's own
        // `location`, so in a non-HTTP frame it never executes `$path`-
        // qualified rules — there is no double execution to avoid.
        if (!isHttpFrame && rule.pathModifier) {
            return rule;
        }

        try {
            return coveredRules.has(await computeRuleHashCached(rule)) ? null : rule;
        } catch (e) {
            if (!loggedHashFailures.has(rule)) {
                loggedHashFailures.add(rule);
                logger.error('[tsweb.coverage]: Failed to hash a rule, keeping dynamic injection', e);
                logger.debug(`[tsweb.coverage]: Rule hashing failed for "${frameUrl}"`);
            }
            return rule;
        }
    }));

    return results.filter((rule): rule is CosmeticRule => rule !== null);
};
