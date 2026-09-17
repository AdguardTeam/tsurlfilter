import { DomainUtils } from '@adguard/agtree';

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
export class CspRulesResolver {
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
     * Creates a stable key for the DNR condition of a source rule.
     *
     * @param rule Source rule.
     *
     * @returns Stable condition key.
     */
    private static getConditionKey(rule: Rule): string {
        const condition = RegularRuleConverter.getCondition(rule);
        return JSON.stringify(CspRulesResolver.canonicalize(condition));
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
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the exception has no value or both values are equal.
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
     * Checks whether an exception has the same DNR condition as a blocking CSP rule.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if both rules have the same DNR condition.
     */
    private static hasSameCondition(exceptionRule: Rule, blockingRule: Rule): boolean {
        return CspRulesResolver.getConditionKey(exceptionRule)
            === CspRulesResolver.getConditionKey(blockingRule);
    }

    /**
     * Creates a stable key for a DNR condition without URL pattern fields.
     *
     * @param rule Source rule.
     *
     * @returns Stable condition key without URL pattern fields.
     */
    private static getConditionWithoutUrlKey(rule: Rule): string {
        const condition: Record<string, unknown> = { ...RegularRuleConverter.getCondition(rule) };
        delete condition.urlFilter;
        delete condition.regexFilter;

        return JSON.stringify(CspRulesResolver.canonicalize(condition));
    }

    /**
     * Checks whether both rules have the same non-URL DNR conditions.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns `true` if the non-URL conditions are equal.
     */
    private static hasSameNonUrlCondition(exceptionRule: Rule, blockingRule: Rule): boolean {
        return CspRulesResolver.getConditionWithoutUrlKey(exceptionRule)
            === CspRulesResolver.getConditionWithoutUrlKey(blockingRule);
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

        const domain = prepareASCII(match[1]).toLowerCase();
        return DomainUtils.isValidDomainOrHostname(domain) ? domain : null;
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

        const domain = prepareASCII(match[1]).toLowerCase();
        return DomainUtils.isValidDomainOrHostname(domain) ? domain : null;
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
            && CspRulesResolver.hasSameNonUrlCondition(exceptionRule, blockingRule);
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
     * Gets a domain which can be excluded from a global blocking rule.
     *
     * @param exceptionRule CSP exception rule.
     * @param blockingRule Blocking CSP rule.
     *
     * @returns Domain to exclude or `null` if subtraction is unsupported.
     */
    private static getExcludedDomain(exceptionRule: Rule, blockingRule: Rule): string | null {
        if (!CspRulesResolver.hasSameNonUrlCondition(exceptionRule, blockingRule)) {
            return null;
        }

        const exceptionDomain = CspRulesResolver.getDomain(exceptionRule);
        if (!exceptionDomain) {
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
                || CspRulesResolver.areDomainsDisjoint(exceptionRule, blockingRule),
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
     * Resolves exact CSP exceptions.
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
        const supportedExceptions = processableExceptions.filter((exceptionRule) => (
            blockingRules.every((blockingRule) => getPairResult(exceptionRule, blockingRule).safe)
        ));
        const excludedRequestDomains = new Map<Rule, string[]>();

        const remainingRules = blockingRules.filter((blockingRule) => {
            if (supportedExceptions.some((exceptionRule) => getPairResult(exceptionRule, blockingRule).cancels)) {
                return false;
            }

            const excludedDomains = supportedExceptions
                .map((exceptionRule) => getPairResult(exceptionRule, blockingRule).excludedDomain)
                .filter((domain): domain is string => domain !== null);
            if (excludedDomains.length > 0) {
                excludedRequestDomains.set(blockingRule, Array.from(new Set(excludedDomains)));
            }

            return true;
        });

        return {
            rules: remainingRules,
            excludedRequestDomains,
            unsupportedExceptions: exceptionRules.filter((exceptionRule) => (
                !supportedExceptions.includes(exceptionRule)
            )),
        };
    }
}
