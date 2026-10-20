import { DomainUtils } from '@adguard/agtree';

import { type RuleCondition } from '../declarative-rule/rule-condition';
import { OPTION_NAMES } from '../rule/option-names';
import { type Rule } from '../rule/rule';
import { RuleDeclarativeValidator } from '../rule/rule-validator';
import { prepareASCII } from '../utils/string';

import { RegularRuleConverter } from './regular-rule-converter';

/**
 * Result of CSP exception resolution.
 */
export interface CspRulesResolution {
    /**
     * Blocking CSP rules which remain active.
     */
    rules: Rule[];

    /**
     * Request domains to exclude from each remaining blocking rule.
     */
    excludedRequestDomains: Map<Rule, string[]>;

    /**
     * CSP exceptions which cannot be applied safely.
     */
    unsupportedExceptions: Rule[];
}

type CspPairResult = {
    cancels: boolean;
    excludedDomain: string | null;
    safe: boolean;
};

/**
 * Resolves CSP exceptions before rules are converted to DNR.
 */
/**
 * Compares one DNR condition field of a CSP exception and a blocking rule.
 *
 * A comparator answers whether the exception is not narrower than the blocking
 * rule in this field and must fail closed: an unsupported value must never be
 * reported as covered.
 */
type ConditionFieldCovers = (
    exceptionCondition: RuleCondition,
    blockingCondition: RuleCondition,
) => boolean;

/**
 * Condition fields which describe the URL identity of a rule.
 */
const URL_CONDITION_FIELDS: readonly (keyof RuleCondition)[] = [
    'urlFilter',
    'regexFilter',
];

/**
 * Resolves CSP exceptions before rules are converted to DNR.
 */
export class CspRulesResolver {
    /**
     * Comparators for every DNR condition field.
     *
     * The mapped type keeps the table exhaustive: a field added to
     * {@link RuleCondition} without a comparator breaks the build, so a new
     * condition field cannot be silently ignored by the resolver.
     *
     * Fields of one pair (`initiatorDomains`/`excludedInitiatorDomains` and so
     * on) share a comparator which reads both of them.
     */
    private static readonly CONDITION_COVERAGE: {
        readonly [K in keyof RuleCondition]-?: ConditionFieldCovers;
    } = {
            urlFilter: CspRulesResolver.createEqualityComparator(['urlFilter', 'regexFilter']),
            regexFilter: CspRulesResolver.createEqualityComparator(['urlFilter', 'regexFilter']),
            domainType: CspRulesResolver.createEqualityComparator(['domainType']),
            initiatorDomains: (exceptionCondition, blockingCondition) => (
                CspRulesResolver.coversInitiatorDomains(
                    exceptionCondition.initiatorDomains,
                    blockingCondition.initiatorDomains,
                )
            ),
            excludedInitiatorDomains: (exceptionCondition, blockingCondition) => (
                CspRulesResolver.coversExcludedDomains(
                    exceptionCondition.excludedInitiatorDomains,
                    blockingCondition.excludedInitiatorDomains,
                )
            ),
            requestDomains: CspRulesResolver.createEqualityComparator(['requestDomains']),
            excludedRequestDomains: (exceptionCondition, blockingCondition) => (
                CspRulesResolver.coversExcludedDomains(
                    exceptionCondition.excludedRequestDomains,
                    blockingCondition.excludedRequestDomains,
                )
            ),
            responseHeaders: (exceptionCondition, blockingCondition) => (
                CspRulesResolver.coversResponseHeaders(
                    exceptionCondition.responseHeaders,
                    blockingCondition.responseHeaders,
                )
            ),
            excludedResponseHeaders: CspRulesResolver.createEqualityComparator(['excludedResponseHeaders']),
            tabIds: CspRulesResolver.createEqualityComparator(['tabIds']),
            excludedTabIds: CspRulesResolver.createEqualityComparator(['excludedTabIds']),
            requestMethods: CspRulesResolver.createEqualityComparator(['requestMethods']),
            excludedRequestMethods: CspRulesResolver.createEqualityComparator(['excludedRequestMethods']),
            resourceTypes: CspRulesResolver.createEqualityComparator(['resourceTypes']),
            excludedResourceTypes: CspRulesResolver.createEqualityComparator(['excludedResourceTypes']),
            isUrlFilterCaseSensitive: CspRulesResolver.createEqualityComparator(['isUrlFilterCaseSensitive']),
        };

    /**
     * All condition fields compared by the resolver.
     */
    private static readonly CONDITION_FIELDS = Object.keys(
        CspRulesResolver.CONDITION_COVERAGE,
    ) as (keyof RuleCondition)[];

    /**
     * Condition fields compared by the non-URL coverage check.
     */
    private static readonly NON_URL_CONDITION_FIELDS = CspRulesResolver.CONDITION_FIELDS
        .filter((field) => !URL_CONDITION_FIELDS.includes(field));

    /**
     * Canonicalizes a value for order-independent comparison.
     *
     * @param value Value to canonicalize.
     *
     * @returns Canonicalized value.
     */
    private static canonicalize(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value
                .map((item) => CspRulesResolver.canonicalize(item))
                .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
        }

        if (value !== null && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value)
                    .sort(([left], [right]) => left.localeCompare(right))
                    .map(([key, item]) => [key, CspRulesResolver.canonicalize(item)]),
            );
        }

        return value;
    }

    /**
     * Creates a comparator which requires the given condition fields to be equal.
     *
     * @param fields Condition fields to compare.
     *
     * @returns Comparator of the given fields.
     */
    private static createEqualityComparator(
        fields: readonly (keyof RuleCondition)[],
    ): ConditionFieldCovers {
        return (exceptionCondition, blockingCondition) => {
            const exceptionValues = fields.map((field) => exceptionCondition[field]);
            const blockingValues = fields.map((field) => blockingCondition[field]);

            return JSON.stringify(CspRulesResolver.canonicalize(exceptionValues))
                === JSON.stringify(CspRulesResolver.canonicalize(blockingValues));
        };
    }

    /**
     * Checks whether a CSP exception can enter resolution.
     *
     * @param exceptionRule CSP exception rule.
     *
     * @returns `true` if the exception can enter resolution.
     */
    private static isProcessableException(exceptionRule: Rule): boolean {
        if (!RegularRuleConverter.areDomainConditionsRepresentable(exceptionRule)) {
            return false;
        }

        try {
            return RuleDeclarativeValidator.shouldProcessCspException(exceptionRule);
        } catch {
            return false;
        }
    }

    /**
     * Checks whether an exception applies to the blocking rule's CSP value.
     *
     * An exception without a value applies to any value; a valued exception
     * applies only when it has a strictly higher priority than the blocking
     * rule and both values are equal.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the exception applies to the blocking rule's value.
     */
    private static hasApplicableValue(exceptionRule: Rule, blockingRule: Rule): boolean {
        const exceptionValue = exceptionRule.advancedModifierValue;
        if (!exceptionValue) {
            return true;
        }

        if (exceptionRule.priority <= blockingRule.priority) {
            return false;
        }

        return exceptionValue === blockingRule.advancedModifierValue;
    }

    /**
     * Checks whether an exception has the same URL identity and is not narrower
     * than a blocking CSP rule in any other condition.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the exception covers the blocking rule's condition.
     */
    private static hasSameCondition(exceptionRule: Rule, blockingRule: Rule): boolean {
        return CspRulesResolver.checkConditionCoverage(
            exceptionRule,
            blockingRule,
            CspRulesResolver.CONDITION_FIELDS,
        );
    }

    /**
     * Checks whether an exception covers a blocking rule's non-URL conditions.
     *
     * Conditions of domain and header fields are compared by coverage: the
     * exception must not be narrower than the blocking rule in any of them.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the exception is not narrower than the blocking rule.
     */
    private static coversNonUrlConditions(exceptionRule: Rule, blockingRule: Rule): boolean {
        return CspRulesResolver.checkConditionCoverage(
            exceptionRule,
            blockingRule,
            CspRulesResolver.NON_URL_CONDITION_FIELDS,
        );
    }

    /**
     * Checks whether an exception covers the given condition fields of a
     * blocking rule.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     * @param fields Condition fields to compare.
     *
     * @returns `true` if the exception is not narrower in any of the fields.
     */
    private static checkConditionCoverage(
        exceptionRule: Rule,
        blockingRule: Rule,
        fields: readonly (keyof RuleCondition)[],
    ): boolean {
        const exceptionCondition = RegularRuleConverter.getCondition(exceptionRule);
        const blockingCondition = RegularRuleConverter.getCondition(blockingRule);

        return fields.every((field) => (
            CspRulesResolver.CONDITION_COVERAGE[field](exceptionCondition, blockingCondition)
        ));
    }

    /**
     * Checks whether an exception's initiator domains cover a blocking rule's ones.
     *
     * An absent exception list means the exception is not restricted by the
     * condition at all, so it covers any list of the blocking rule.
     *
     * @param exceptionList Domains of the exception.
     * @param blockingList Domains of the blocking rule.
     *
     * @returns `true` if the exception's list covers the blocking rule's list.
     */
    private static coversInitiatorDomains(exceptionList: unknown, blockingList: unknown): boolean {
        return exceptionList === undefined
            || CspRulesResolver.isDomainListSubset(blockingList, exceptionList);
    }

    /**
     * Checks whether an exception excludes no more domains than a blocking rule.
     *
     * Used for excluded initiator domains (`$domain` negations) and excluded
     * request domains (`$denyallow`, `$to` negations): an absent list means the
     * rule excludes nothing, so the rule with fewer exclusions has the wider
     * scope and covers the other one.
     *
     * @param exceptionList Excluded domains of the exception.
     * @param blockingList Excluded domains of the blocking rule.
     *
     * @returns `true` if the exception excludes a subset of the blocking rule's domains.
     */
    private static coversExcludedDomains(exceptionList: unknown, blockingList: unknown): boolean {
        return CspRulesResolver.isDomainListSubset(exceptionList ?? [], blockingList ?? []);
    }

    /**
     * Checks whether an exception's response headers cover a blocking rule's ones.
     *
     * An absent exception list means the exception is not restricted by the
     * condition at all, so it covers any list of the blocking rule.
     *
     * @param exceptionHeaders Headers of the exception.
     * @param blockingHeaders Headers of the blocking rule.
     *
     * @returns `true` if the exception's list covers the blocking rule's list.
     */
    private static coversResponseHeaders(exceptionHeaders: unknown, blockingHeaders: unknown): boolean {
        return exceptionHeaders === undefined
            || CspRulesResolver.isHeaderListSubset(blockingHeaders, exceptionHeaders);
    }

    /**
     * Normalizes a domain written in a rule pattern.
     *
     * The host in a URL is always lowercased, so a `$match-case` rule with an
     * uppercase domain can never match a request: such a domain is kept as
     * written instead of being normalized into a matching one.
     *
     * @param rule Rule the domain belongs to.
     * @param domain Domain as written in the pattern.
     *
     * @returns Domain to compare, or `null` if it is not a valid domain.
     */
    private static normalizeDomain(rule: Rule, domain: string): string | null {
        const asciiDomain = prepareASCII(domain);

        // Validation expects the canonical lowercased form.
        if (!DomainUtils.isValidDomainOrHostname(asciiDomain.toLowerCase())) {
            return null;
        }

        return rule.isModifierEnabled(OPTION_NAMES.MATCH_CASE)
            ? asciiDomain
            : asciiDomain.toLowerCase();
    }

    /**
     * Checks whether an exception can match a request host.
     *
     * The host in a URL is always lowercased, so a `$match-case` exception
     * whose pattern domain is written with uppercase letters can never match.
     *
     * @param exceptionRule CSP exception rule.
     *
     * @returns `true` if the exception can match a request host.
     */
    private static canMatchRequestHost(exceptionRule: Rule): boolean {
        if (!exceptionRule.isModifierEnabled(OPTION_NAMES.MATCH_CASE)) {
            return true;
        }

        const domain = CspRulesResolver.getDomain(exceptionRule)
            ?? CspRulesResolver.getAnchoredDomain(exceptionRule);

        return domain === null || domain === domain.toLowerCase();
    }

    /**
     * Extracts a domain from a clean domain-anchored pattern.
     *
     * @param rule Rule to inspect.
     *
     * @returns ASCII domain or `null` for a non-domain-only pattern.
     */
    private static getDomain(rule: Rule): string | null {
        const match = /^\|\|([^*/^|]+)\^$/.exec(rule.pattern);
        if (!match) {
            return null;
        }

        return CspRulesResolver.normalizeDomain(rule, match[1]);
    }

    /**
     * Extracts the domain from an anchored pattern without broad wildcards.
     *
     * @param rule Rule to inspect.
     *
     * @returns ASCII domain or `null` for an unsupported pattern.
     */
    private static getAnchoredDomain(rule: Rule): string | null {
        const match = /^\|\|([^*/^|]+)(?:\^|\/)/.exec(rule.pattern);
        if (!match) {
            return null;
        }

        return CspRulesResolver.normalizeDomain(rule, match[1]);
    }

    /**
     * Checks whether a domain belongs to a parent domain.
     *
     * @param domain Domain to check.
     * @param parentDomain Potential parent domain.
     *
     * @returns `true` if the parent domain covers the domain.
     */
    private static isDomainCovered(domain: string, parentDomain: string): boolean {
        return domain === parentDomain || domain.endsWith(`.${parentDomain}`);
    }

    /**
     * Checks whether each domain in one list is covered by another list.
     *
     * @param subset Domains that must be covered.
     * @param superset Domains that may cover them.
     *
     * @returns `true` if the first domain list is a subset of the second.
     */
    private static isDomainListSubset(subset: unknown, superset: unknown): boolean {
        return Array.isArray(subset)
            && Array.isArray(superset)
            && subset.every((domain) => (
                typeof domain === 'string'
                && superset.some((parentDomain) => (
                    typeof parentDomain === 'string'
                    && CspRulesResolver.isDomainCovered(domain, parentDomain)
                ))
            ));
    }

    /**
     * Checks whether each header condition is covered by another list.
     *
     * @param subset Header conditions that must be covered.
     * @param superset Header conditions that may cover them.
     *
     * @returns `true` if the first header list is a subset of the second.
     */
    private static isHeaderListSubset(subset: unknown, superset: unknown): boolean {
        return Array.isArray(subset)
            && Array.isArray(superset)
            && subset.every((header) => (
                superset.some((coveringHeader) => (
                    CspRulesResolver.isHeaderInfoCovered(header, coveringHeader)
                ))
            ));
    }

    /**
     * Checks whether one DNR header condition covers another.
     *
     * @param header Header condition to check.
     * @param coveringHeader Potential covering header condition.
     *
     * @returns `true` if the second header condition covers the first.
     */
    private static isHeaderInfoCovered(header: unknown, coveringHeader: unknown): boolean {
        if (
            header === null
            || coveringHeader === null
            || typeof header !== 'object'
            || typeof coveringHeader !== 'object'
        ) {
            return false;
        }

        const headerInfo = header as Record<string, unknown>;
        const coveringHeaderInfo = coveringHeader as Record<string, unknown>;
        if (
            typeof headerInfo.header !== 'string'
            || typeof coveringHeaderInfo.header !== 'string'
            || headerInfo.header.toLowerCase() !== coveringHeaderInfo.header.toLowerCase()
        ) {
            return false;
        }

        const coveringHeaderHasValueRestrictions = coveringHeaderInfo.values !== undefined
            || coveringHeaderInfo.excludedValues !== undefined;

        return !coveringHeaderHasValueRestrictions
            || JSON.stringify(CspRulesResolver.canonicalize(headerInfo))
                === JSON.stringify(CspRulesResolver.canonicalize(coveringHeaderInfo));
    }

    /**
     * Checks whether a domain exception covers a domain blocking rule.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the exception covers the blocking rule.
     */
    private static coversBlockingDomain(exceptionRule: Rule, blockingRule: Rule): boolean {
        const exceptionDomain = CspRulesResolver.getDomain(exceptionRule);
        const blockingDomain = CspRulesResolver.getAnchoredDomain(blockingRule);

        return exceptionDomain !== null
            && blockingDomain !== null
            && CspRulesResolver.isDomainCovered(blockingDomain, exceptionDomain)
            && CspRulesResolver.coversNonUrlConditions(exceptionRule, blockingRule);
    }

    /**
     * Checks whether an exception covers a blocking rule entirely.
     *
     * A pattern-less exception applies to every URL, so it covers any blocking
     * rule whose non-URL conditions it is not narrower than. A `*`-only
     * pattern matches every URL as well and is treated the same way. This
     * handles global blockers narrowed by `$denyallow`/`$domain` that a
     * pattern-less exception fully covers.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the exception covers the whole blocking rule.
     */
    private static coversWholeRule(exceptionRule: Rule, blockingRule: Rule): boolean {
        return (!exceptionRule.pattern || exceptionRule.pattern === '*')
            && CspRulesResolver.coversNonUrlConditions(exceptionRule, blockingRule);
    }

    /**
     * Checks whether two clean domain patterns cannot match the same request domain.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the domain scopes are disjoint.
     */
    private static areDomainsDisjoint(exceptionRule: Rule, blockingRule: Rule): boolean {
        const exceptionDomain = CspRulesResolver.getAnchoredDomain(exceptionRule);
        const blockingDomain = CspRulesResolver.getAnchoredDomain(blockingRule);
        if (!exceptionDomain || !blockingDomain) {
            return false;
        }

        return !CspRulesResolver.isDomainCovered(exceptionDomain, blockingDomain)
            && !CspRulesResolver.isDomainCovered(blockingDomain, exceptionDomain);
    }

    /**
     * Checks whether two rules cannot match the same initiator domain.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the initiator domain scopes are disjoint.
     */
    private static areInitiatorDomainsDisjoint(exceptionRule: Rule, blockingRule: Rule): boolean {
        const exceptionDomains = RegularRuleConverter.getCondition(exceptionRule).initiatorDomains;
        const blockingDomains = RegularRuleConverter.getCondition(blockingRule).initiatorDomains;
        if (!exceptionDomains || !blockingDomains) {
            return false;
        }

        return exceptionDomains.every((exceptionDomain) => (
            blockingDomains.every((blockingDomain) => (
                !CspRulesResolver.isDomainCovered(exceptionDomain, blockingDomain)
                && !CspRulesResolver.isDomainCovered(blockingDomain, exceptionDomain)
            ))
        ));
    }

    /**
     * Gets a domain which can be excluded from a global blocking rule.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns Domain to exclude or `null` if subtraction is unsupported.
     */
    private static getExcludedDomain(exceptionRule: Rule, blockingRule: Rule): string | null {
        if (!CspRulesResolver.coversNonUrlConditions(exceptionRule, blockingRule)) {
            return null;
        }

        const exceptionDomain = CspRulesResolver.getDomain(exceptionRule);
        if (!exceptionDomain) {
            return null;
        }

        // A domain that can never match a request must not be excluded from a blocker.
        if (!CspRulesResolver.canMatchRequestHost(exceptionRule)) {
            return null;
        }

        const blockingDomain = CspRulesResolver.getAnchoredDomain(blockingRule);
        const isDisjoint = blockingDomain !== null
            && !CspRulesResolver.isDomainCovered(exceptionDomain, blockingDomain)
            && !CspRulesResolver.isDomainCovered(blockingDomain, exceptionDomain);

        return isDisjoint ? null : exceptionDomain;
    }

    /**
     * Classifies how a CSP exception affects a blocking rule.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns Pair resolution result.
     */
    private static classifyPair(exceptionRule: Rule, blockingRule: Rule): CspPairResult {
        const hasApplicableValue = CspRulesResolver.hasApplicableValue(exceptionRule, blockingRule);
        const cancels = hasApplicableValue
            && (
                CspRulesResolver.hasSameCondition(exceptionRule, blockingRule)
                || CspRulesResolver.coversBlockingDomain(exceptionRule, blockingRule)
                || CspRulesResolver.coversWholeRule(exceptionRule, blockingRule)
            );
        const excludedDomain = hasApplicableValue && !cancels
            ? CspRulesResolver.getExcludedDomain(exceptionRule, blockingRule)
            : null;

        return {
            cancels,
            excludedDomain,
            safe: !hasApplicableValue
                || cancels
                || excludedDomain !== null
                || !CspRulesResolver.canMatchRequestHost(exceptionRule)
                || CspRulesResolver.areDomainsDisjoint(exceptionRule, blockingRule)
                || CspRulesResolver.areInitiatorDomainsDisjoint(exceptionRule, blockingRule),
        };
    }

    /**
     * Creates a cached CSP pair result getter.
     *
     * @returns Pair result getter scoped to one resolution.
     */
    private static createPairResultGetter(): (exceptionRule: Rule, blockingRule: Rule) => CspPairResult {
        const pairResults = new Map<Rule, Map<Rule, CspPairResult>>();

        return (exceptionRule: Rule, blockingRule: Rule): CspPairResult => {
            let resultsForException = pairResults.get(exceptionRule);
            if (!resultsForException) {
                resultsForException = new Map();
                pairResults.set(exceptionRule, resultsForException);
            }

            let result = resultsForException.get(blockingRule);
            if (!result) {
                result = CspRulesResolver.classifyPair(exceptionRule, blockingRule);
                resultsForException.set(blockingRule, result);
            }

            return result;
        };
    }

    /**
     * Resolves CSP exceptions against blocking rules.
     *
     * Each exception is applied per pair with a blocking rule: a pair cancels
     * the blocking rule when the exception fully covers it, or contributes an
     * excluded request domain when the exception is a clean domain. An
     * exception is never required to be safe against every blocking rule; an
     * unsafe pair simply leaves its blocking rule untouched while other pairs
     * of the same exception still apply.
     *
     * @param rules CSP rules from active sources.
     *
     * @returns Remaining rules and exception resolution details.
     */
    public static resolve(rules: Rule[]): CspRulesResolution {
        const cspRules = rules.filter((rule) => rule.isModifierEnabled(OPTION_NAMES.CSP));
        const blockingRules = cspRules.filter((rule) => !rule.allowlist);
        const exceptionRules = cspRules.filter((rule) => rule.allowlist);
        const processableExceptions = exceptionRules.filter(CspRulesResolver.isProcessableException);
        const getPairResult = CspRulesResolver.createPairResultGetter();
        const appliedExceptions = new Set<Rule>();
        const excludedRequestDomains = new Map<Rule, string[]>();

        const remainingRules = blockingRules.filter((blockingRule) => {
            let cancelled = false;
            const excludedDomains: string[] = [];

            processableExceptions.forEach((exceptionRule) => {
                const pair = getPairResult(exceptionRule, blockingRule);
                if (pair.cancels) {
                    cancelled = true;
                    appliedExceptions.add(exceptionRule);
                } else if (pair.excludedDomain !== null) {
                    excludedDomains.push(pair.excludedDomain);
                    appliedExceptions.add(exceptionRule);
                }
            });

            if (cancelled) {
                return false;
            }

            if (excludedDomains.length > 0) {
                excludedRequestDomains.set(blockingRule, Array.from(new Set(excludedDomains)));
            }

            return true;
        });

        const unsupportedExceptions = exceptionRules.filter((exceptionRule) => {
            if (!processableExceptions.includes(exceptionRule)) {
                return true;
            }

            if (appliedExceptions.has(exceptionRule)) {
                return false;
            }

            return blockingRules.some((blockingRule) => !getPairResult(exceptionRule, blockingRule).safe);
        });

        return {
            rules: remainingRules,
            excludedRequestDomains,
            unsupportedExceptions,
        };
    }
}
