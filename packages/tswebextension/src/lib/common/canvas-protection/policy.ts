import { getDomain } from '../utils/url';

import {
    type Available,
    type CanvasBootstrapSnapshot,
    type DocumentPolicyInput,
    type DocumentProtectionContext,
    type InheritedTopContext,
    type PreparedCondition,
    type PreparedPolicyRule,
    type SiteIdentity,
} from './contracts';

/**
 * Captures an availability wrapper without retaining a mutable input wrapper.
 *
 * @param value An already trusted synchronous value.
 *
 * @returns A frozen copy of its availability status.
 */
const capture = <T>(value: Available<T>): Available<T> => Object.freeze({ ...value });

/**
 * Resolves the complete hostname with the extension's existing site-key rules.
 *
 * @param url The delivered document's own URL or a trusted captured top URL.
 * @param mode The context supplying the site identity.
 *
 * @returns An immutable hostname key or the concrete unavailable-host reason.
 */
export const resolveSiteIdentity = (url: string, mode: SiteIdentity['mode']): Available<SiteIdentity> => {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return Object.freeze({ status: 'unavailable', reason: 'invalid-document-url' });
    }
    if (!parsed.hostname) {
        return Object.freeze({ status: 'unavailable', reason: 'complete-hostname-unavailable' });
    }

    // The shared helper's first-colon extraction cannot represent IPv6 or credential authorities.
    const needsCompleteHost = parsed.hostname.startsWith('[') || !!parsed.username || !!parsed.password;
    const hostname = needsCompleteHost ? parsed.hostname.replace(/\.$/, '').replace(/^www\./, '')
        : getDomain(parsed.href);
    if (!hostname) {
        return Object.freeze({ status: 'unavailable', reason: 'complete-hostname-unavailable' });
    }
    return Object.freeze({ status: 'available', value: Object.freeze({ key: hostname, mode, sourceUrl: url }) });
};

/**
 * Copies captured top values so later input changes cannot upgrade a document.
 *
 * @param top Trusted synchronous top context.
 *
 * @returns An immutable top-context copy without root or site seed.
 */
const captureTop = (top: Available<InheritedTopContext>): Available<InheritedTopContext> => {
    if (top.status === 'unavailable') {
        return capture(top);
    }
    const { value } = top;
    const site: Available<SiteIdentity> = value.site.status === 'available'
        ? Object.freeze({ status: 'available', value: Object.freeze({ ...value.site.value }) }) : capture(value.site);
    return Object.freeze({
        status: 'available',
        value: Object.freeze({
            documentExcluded: capture(value.documentExcluded),
            allowlistExcluded: capture(value.allowlistExcluded),
            site,
            policyRevision: capture(value.policyRevision),
            capturedGeneration: capture(value.capturedGeneration),
        }),
    });
};

/**
 * Combines exact three-state predicates without treating unknown data as false.
 *
 * @param results Operand decisions.
 * @param operation Boolean combination.
 *
 * @returns A determinate result when an operand decides it, otherwise unavailable.
 */
const combine = (results: readonly Available<boolean>[], operation: 'and' | 'or'): Available<boolean> => {
    const decisiveValue = operation === 'or';
    if (results.some((result) => result.status === 'available' && result.value === decisiveValue)) {
        return { status: 'available', value: decisiveValue };
    }
    const unknown = results.find((result) => result.status === 'unavailable');
    if (unknown) {
        return unknown;
    }
    return { status: 'available', value: !decisiveValue };
};

/**
 * Evaluates prepared document decisions before any canvas or masking hooks exist.
 *
 * @param snapshot Trusted current registration snapshot.
 * @param input Exact synchronous document and available request-source information.
 *
 * @returns A frozen decision with independent own and inherited provenance.
 */
export const resolveDocumentProtection = (
    snapshot: CanvasBootstrapSnapshot,
    input: DocumentPolicyInput,
): DocumentProtectionContext => {
    const reasons = new Set(snapshot.policy.unavailableConditions);
    const inheritedTop = captureTop(input.inheritedTop);
    const sourceUrl = capture(input.sourceUrl);
    const ownSite = resolveSiteIdentity(input.url, input.requestType === 'document' ? 'top-derived' : 'frame-local');

    /**
     * Records an unavailable field without changing a determinate sibling outcome.
     *
     * @param available A trusted availability result.
     *
     * @returns The same availability result.
     */
    const record = <T>(available: Available<T>): Available<T> => {
        if (available.status === 'unavailable') {
            reasons.add(available.reason);
        }
        return available;
    };

    if (input.requestType === 'subdocument') {
        record(inheritedTop);
        if (inheritedTop.status === 'available') {
            record(inheritedTop.value.documentExcluded);
            record(inheritedTop.value.allowlistExcluded);
            record(inheritedTop.value.site);
            record(inheritedTop.value.policyRevision);
            record(inheritedTop.value.capturedGeneration);
        }
    }
    record(ownSite);

    /**
     * Finds a prepared predicate's exact synchronous URL input.
     *
     * @param kind Predicate input selector.
     *
     * @returns The URL or a concrete unavailability result.
     */
    const resolveUrl = (kind: 'frame-url' | 'top-url' | 'source-url'): Available<string> => {
        if (kind === 'frame-url') {
            return { status: 'available', value: input.url };
        }
        if (kind === 'source-url') {
            return sourceUrl;
        }
        if (input.requestType === 'document') {
            return { status: 'available', value: input.url };
        }
        if (inheritedTop.status === 'unavailable') {
            return inheritedTop;
        }
        const { site } = inheritedTop.value;
        return site.status === 'available' ? { status: 'available', value: site.value.sourceUrl } : site;
    };

    /**
     * Evaluates a trusted prepared condition with three-state boolean semantics.
     *
     * @param condition Exact predicate prepared by the policy producer.
     *
     * @returns Exact match/nonmatch or unavailable when required data is unknown.
     *
     * @throws When a trusted artifact contains an unexpected condition type.
     */
    const evaluate = (condition: PreparedCondition): Available<boolean> => {
        switch (condition.type) {
            case 'unavailable':
                return record({ status: 'unavailable', reason: condition.reason });
            case 'url-regexp': {
                const url = record(resolveUrl(condition.input));
                if (url.status === 'unavailable') {
                    return url;
                }
                return { status: 'available', value: new RegExp(condition.pattern, condition.flags).test(url.value) };
            }
            case 'and':
            case 'or':
                return combine(condition.operands.map(evaluate), condition.type);
            case 'not': {
                const result = evaluate(condition.operand);
                return result.status === 'available' ? { status: 'available', value: !result.value } : result;
            }
            default:
                throw new Error('Unexpected prepared condition');
        }
    };

    /**
     * Evaluates only the rules applicable to this document request type.
     *
     * @param rules Prepared exclusions with explicit request masks.
     *
     * @returns The combined exact exclusion decision.
     */
    const evaluateRules = (rules: readonly PreparedPolicyRule[]): Available<boolean> => combine(
        rules.filter((rule) => rule.requestTypes.includes(input.requestType)).map((rule) => evaluate(rule.condition)),
        'or',
    );

    const ownFrameExclusion = evaluateRules(snapshot.policy.ownFrameExclusions);
    let documentExclusion: Available<boolean>;
    if (input.requestType === 'document') {
        documentExclusion = evaluateRules(snapshot.policy.documentExclusions);
    } else if (inheritedTop.status === 'available') {
        documentExclusion = combine([inheritedTop.value.documentExcluded, inheritedTop.value.allowlistExcluded], 'or');
    } else {
        documentExclusion = inheritedTop;
    }
    const inheritedSite = input.requestType === 'subdocument' && inheritedTop.status === 'available'
        && inheritedTop.value.documentExcluded.status === 'available'
        && inheritedTop.value.allowlistExcluded.status === 'available'
        && inheritedTop.value.site.status === 'available' ? inheritedTop.value.site : undefined;
    const site: Available<SiteIdentity> = inheritedSite?.status === 'available'
        ? Object.freeze({ status: 'available', value: Object.freeze({ ...inheritedSite.value, mode: 'top-derived' }) })
        : ownSite;
    const excluded = (ownFrameExclusion.status === 'available' && ownFrameExclusion.value)
        || (documentExclusion.status === 'available' && documentExclusion.value);
    const gates = Object.freeze({ ...snapshot.gates });
    const requested = gates.filteringEnabled && gates.stealthModeEnabled && gates.protectCanvas;
    let outcome: DocumentProtectionContext['outcome'] = 'enabled';
    if (!requested) {
        outcome = 'disabled';
    } else if (excluded) {
        outcome = 'excluded';
    } else if (site.status === 'unavailable') {
        outcome = 'unsupported';
    }

    return Object.freeze({
        outcome,
        enabled: outcome === 'enabled',
        excluded,
        gates,
        policyRevision: snapshot.policy.revision,
        capturedGeneration: snapshot.session.generation,
        site,
        provenance: Object.freeze({
            requestType: input.requestType,
            frameUrl: input.url,
            sourceUrl,
            inheritedTop,
            ownFrameExclusion: capture(ownFrameExclusion),
            documentExclusion: capture(documentExclusion),
        }),
        unavailableConditions: Object.freeze([...reasons]),
    });
};
