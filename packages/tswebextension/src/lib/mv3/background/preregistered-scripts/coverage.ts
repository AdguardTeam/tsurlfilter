import { type CosmeticRule } from '@adguard/tsurlfilter';

import { MAIN_FRAME_ID } from '../../../common/constants';
import { logger } from '../../../common/utils/logger';
import { isHttpRequest } from '../../../common/utils/url';
import { type FrameMV3 } from '../../tabs/frame';
import { appContext } from '../app-context';

import { computeRuleHashCached } from './hasher';

/**
 * Rules whose hash failure has already been logged. Hashing failures are
 * deterministic and this filter runs per frame, so without the set one
 * broken rule would re-log on every frame of every covered host.
 */
const loggedHashFailures = new WeakSet<CosmeticRule>();

/**
 * Parses a URL hostname.
 *
 * @param url URL to parse.
 *
 * @returns Hostname or `null` when unparseable.
 */
const parseHostname = (url: string): string | null => {
    try {
        const { hostname } = new URL(url);
        return hostname || null;
    } catch {
        return null;
    }
};

/**
 * Returns the hashes of preregistered rules covered for the frame — those
 * dynamic injection must skip.
 *
 * Only the top-level document takes the fast path. A subframe's verdict
 * depends on the rules of its parent (the engine passes the parent's frame
 * rule into the subdocument match), and the page cannot read the parent's
 * URL when the domains differ, so every frame stays on the dynamic path and
 * the engine decides.
 *
 * @param frameContext Frame context.
 * @param preExistingDocument Whether the document loaded before the current
 * service worker started: such a document is judged only against the rules
 * from registrations persisted at boot, since a registration updated since
 * then may carry rules the page never received.
 *
 * @returns Covered rule hashes or `undefined` when there is no coverage.
 */
export const getCoveredRules = (
    frameContext: FrameMV3,
    preExistingDocument = false,
): ReadonlySet<string> | undefined => {
    if (frameContext.frameId !== MAIN_FRAME_ID || !isHttpRequest(frameContext.url)) {
        return undefined;
    }

    const coveredRules = preExistingDocument
        ? appContext.preregisteredScriptRulesAtBoot
        : appContext.preregisteredScriptRules;

    if (!coveredRules || coveredRules.size === 0) {
        return undefined;
    }

    const host = parseHostname(frameContext.url);

    return host ? coveredRules.get(host) : undefined;
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
