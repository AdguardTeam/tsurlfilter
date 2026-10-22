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
 * Reads the live frame tree of a tab.
 */
export type FrameTreeLookup = (tabId: number) => Promise<Map<number, FrameMV3> | undefined>;

/**
 * Rules whose hash failure has already been logged. Hashing failures are
 * deterministic and this filter runs per frame, so without the set one
 * broken rule would re-log on every frame of every covered host.
 */
const loggedHashFailures = new WeakSet<CosmeticRule>();

/**
 * Parses a URL hostname, lower-cased.
 *
 * @param url URL to parse.
 *
 * @returns Hostname or `null` when missing or unparseable.
 */
const parseHostname = (url: unknown): string | null => {
    if (typeof url !== 'string' || url === '') {
        return null;
    }

    try {
        const { hostname } = new URL(url);
        return hostname ? hostname.toLowerCase() : null;
    } catch {
        return null;
    }
};

/**
 * Resolves the origin host of an opaque frame URL (`blob:` carries the
 * creator's origin, `data:` is opaque).
 *
 * @param url Frame URL.
 *
 * @returns Origin hostname, or `null` for an opaque origin.
 */
const parseUrlOriginHost = (url: string): string | null => {
    try {
        const { origin } = new URL(url);
        if (origin === 'null') {
            return null;
        }
        return parseHostname(origin);
    } catch {
        return null;
    }
};

/**
 * Reads the live frame tree of a tab, used when the cached frame contexts no
 * longer cover the ancestor chain.
 *
 * @param tabId Tab id.
 *
 * @returns Frame id → frame map, or `undefined` when unreadable.
 */
const getLiveFrameTree: FrameTreeLookup = async (tabId) => {
    try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        if (!frames) {
            return undefined;
        }

        return new Map(frames.map(({ frameId, parentFrameId, url }) => [
            frameId,
            { frameId, parentFrameId, url } as unknown as FrameMV3,
        ]));
    } catch (e) {
        logger.debug('[tsweb.coverage]: failed to read the frame tree', e);
        return undefined;
    }
};

/**
 * Resolves the hostname whose preregistered coverage applies to a frame, or
 * `null` when the frame must stay on the dynamic path.
 *
 * Only the top-level origin decides: the filtering state (allowlist,
 * inverted allowlist) is tab-level, and the page gate checks
 * `location.ancestorOrigins` the same way. Intermediate frames do not
 * participate. The returned key is the nearest HTTP(S) host, which is what
 * `matchOriginAsFallback` matched the registration against. A missing cached
 * parent is resolved from the live frame tree.
 *
 * @param tabId Tab id.
 * @param frameContext Frame context to resolve the host for.
 * @param getFrameContext Injected frame lookup.
 * @param hostnames Preregistered hostnames.
 * @param getFrameTree Injected live frame tree lookup.
 *
 * @returns Coverage hostname or `null`.
 */
export const resolveCoverageHost = async (
    tabId: number,
    frameContext: FrameMV3,
    getFrameContext: FrameContextLookup,
    hostnames: ReadonlySet<string>,
    getFrameTree: FrameTreeLookup = getLiveFrameTree,
): Promise<string | null> => {
    const visited = new Set<number>();
    let current: FrameMV3 | undefined = frameContext;
    let coverageHost: string | null = null;
    let topHost: string | null = null;
    let liveFrames: Map<number, FrameMV3> | undefined;

    while (current) {
        // Broken parent chains must not loop forever.
        if (visited.has(current.frameId)) {
            return null;
        }
        visited.add(current.frameId);

        const isHttp = isHttpRequest(current.url);
        const host = isHttp ? parseHostname(current.url) : null;
        // The nearest HTTP(S) node is the coverage key; the last node of the
        // walk is the top frame, whose origin decides.
        coverageHost ??= host;
        topHost = isHttp ? host : parseUrlOriginHost(current.url);

        if (current.parentFrameId < 0) {
            break;
        }

        const { parentFrameId }: FrameMV3 = current;
        const cachedParent = getFrameContext(tabId, parentFrameId);

        if (cachedParent) {
            current = cachedParent;
            continue;
        }

        // Pruned cache: resolve the parent from the live tree.
        // eslint-disable-next-line no-await-in-loop
        liveFrames ??= await getFrameTree(tabId);
        const liveParent: FrameMV3 | undefined = liveFrames?.get(parentFrameId);
        if (!liveParent) {
            return null;
        }
        current = liveParent;
    }

    if (!topHost || !hostnames.has(topHost)) {
        return null;
    }

    return coverageHost;
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
export const getCoveredRules = async (
    tabId: number,
    frameContext: FrameMV3,
    getFrameContext: FrameContextLookup,
    preExistingDocument = false,
): Promise<ReadonlySet<string> | undefined> => {
    const coveredRules = preExistingDocument
        ? appContext.preregisteredScriptRulesAtBoot
        : appContext.preregisteredScriptRules;

    if (!coveredRules || coveredRules.size === 0) {
        return undefined;
    }

    const hostnames = appContext.preregisteredHostnames;
    if (!hostnames || hostnames.size === 0) {
        return undefined;
    }

    const host = await resolveCoverageHost(tabId, frameContext, getFrameContext, hostnames);
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
