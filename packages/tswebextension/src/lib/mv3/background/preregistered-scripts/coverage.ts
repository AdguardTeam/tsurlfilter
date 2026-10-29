import { type CosmeticRule } from '@adguard/tsurlfilter';

import { NO_PARENT_FRAME_ID } from '../../../common/constants';
import { logger } from '../../../common/utils/logger';
import { isHttpRequest } from '../../../common/utils/url';
import { type FrameMV3 } from '../../tabs/frame';
import { appContext } from '../app-context';

import { computeRuleHashCached } from './hasher';

/**
 * Minimal frame shape the ancestor walk needs: the fields available both
 * from the cached frame contexts and from `webNavigation.getAllFrames`.
 * Document ids are optional — MV2 has none, and the live tree carries no
 * `parentDocumentId`.
 */
type FrameNode = Pick<
    FrameMV3,
    'frameId' | 'parentFrameId' | 'url' | 'documentId' | 'parentDocumentId'
>;

/**
 * Looks up a frame context by tab and frame id.
 */
export type FrameContextLookup = (tabId: number, frameId: number) => FrameMV3 | undefined;

/**
 * Reads the live frame tree of a tab.
 */
export type FrameTreeLookup = (tabId: number) => Promise<Map<number, FrameNode> | undefined>;

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
 * Returns whether a cached frame context describes the document the child
 * belongs to. The top frame context is overwritten at navigation start,
 * before the navigation commits, so a navigation that never commits leaves
 * the new URL on the old page. Document ids are optional (MV2 has none), so
 * a missing id cannot disprove the match and the cached context is trusted.
 *
 * @param parentDocumentId Document id the child reports for its parent.
 * @param documentId Document id of the cached parent context.
 *
 * @returns True when the cached context may be used.
 */
const isSameDocument = (
    parentDocumentId: string | undefined,
    documentId: string | undefined,
): boolean => !parentDocumentId || !documentId || parentDocumentId === documentId;

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
            logger.warn(`[tsweb.coverage]: Empty frame tree for tab ${tabId}, keeping its frames on dynamic injection`);
            return undefined;
        }

        return new Map(frames.map(({
            frameId,
            parentFrameId,
            url,
            documentId,
        }) => [
            frameId,
            {
                frameId,
                parentFrameId,
                url,
                documentId,
            },
        ]));
    } catch (e) {
        logger.warn(`[tsweb.coverage]: Failed to read the frame tree for tab ${tabId}, keeping its frames on dynamic injection`, e);
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
 * @param isCoveredHost Optional check on the nearest HTTP(S) host: when it
 * returns false, the walk stops before reaching the top frame, because no
 * top-level origin can make an uncovered host covered.
 *
 * @returns Coverage hostname or `null`.
 */
export const resolveCoverageHost = async (
    tabId: number,
    frameContext: FrameMV3,
    getFrameContext: FrameContextLookup,
    hostnames: ReadonlySet<string>,
    getFrameTree: FrameTreeLookup = getLiveFrameTree,
    isCoveredHost?: (host: string) => boolean,
): Promise<string | null> => {
    const visited = new Set<number>();
    let current: FrameNode | undefined = frameContext;
    let coverageHost: string | null = null;
    let topHost: string | null = null;
    let liveFrames: Map<number, FrameNode> | undefined;

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

        // Nothing is registered for the nearest HTTP(S) host: no top-level
        // origin can change that, so stop before paying for the rest of the
        // walk and for a possible `getAllFrames` round trip.
        if (coverageHost !== null && isCoveredHost && !isCoveredHost(coverageHost)) {
            return null;
        }

        if (current.parentFrameId === NO_PARENT_FRAME_ID) {
            break;
        }

        const { parentFrameId }: FrameNode = current;
        // Once the live tree is read it is the only source: mixing it with
        // the cache could splice two different document trees together.
        const cachedParent: FrameMV3 | undefined = liveFrames
            ? undefined
            : getFrameContext(tabId, parentFrameId);

        if (cachedParent && isSameDocument(current.parentDocumentId, cachedParent.documentId)) {
            current = cachedParent;
            continue;
        }

        // Pruned cache, or an entry that describes another document: resolve
        // the parent from the live tree.
        // eslint-disable-next-line no-await-in-loop
        liveFrames ??= await getFrameTree(tabId);
        const liveParent: FrameNode | undefined = liveFrames?.get(parentFrameId);
        if (!liveParent) {
            logger.warn(`[tsweb.coverage]: Frame ${parentFrameId} is missing from the live tree of tab ${tabId}, keeping the frame on dynamic injection`);
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

    const host = await resolveCoverageHost(
        tabId,
        frameContext,
        getFrameContext,
        hostnames,
        undefined,
        (candidate) => coveredRules.has(candidate),
    );
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
