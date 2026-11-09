import { type CosmeticRule } from '@adguard/tsurlfilter';

import { NO_PARENT_FRAME_ID } from '../../../common/constants';
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
 * Only the outermost document takes the fast path, including a prerender
 * whose frame id is not zero. A subframe's verdict depends on the main
 * frame's rule and URL (the engine passes those into the subdocument
 * match), and the page cannot read the main-frame URL when the domains
 * differ, so every frame stays on the dynamic path and the engine decides.
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
    // A prerendered outermost document can have a non-zero frame id.
    // `onBeforeNavigate` skips only a frame-0 prerender, so the context
    // lands under that id. The registration still runs there (`allFrames:
    // false` matches the outermost frame), so coverage must too.
    if (frameContext.parentFrameId !== NO_PARENT_FRAME_ID || !isHttpRequest(frameContext.url)) {
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
 * @param rawRules Candidate rules to filter.
 * @param coveredRules Hashes of rules covered by preregistered registrations.
 * @param frameUrl Frame URL, used for logging.
 *
 * @returns Rules not covered by preregistered content scripts.
 */
export const filterUncoveredRules = async (
    rawRules: CosmeticRule[],
    coveredRules: ReadonlySet<string>,
    frameUrl: string,
): Promise<CosmeticRule[]> => {
    const results = await Promise.all(rawRules.map(async (rule) => {
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
