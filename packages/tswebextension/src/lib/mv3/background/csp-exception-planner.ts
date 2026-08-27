import type { DeclarativeRule, Rule } from '@adguard/dnr-converter';

const CSP_HEADER_NAME = 'Content-Security-Policy';
const CSP_MODIFIER_NAME = 'csp';
const DOMAIN_EXCEPTION_PATTERN = /^\|\|([a-z0-9.-]+)\^$/i;

/**
 * Result of applying CSP allowlist rules to a single declarative CSP rule.
 */
export type CspExceptionPlan = {
    /**
     * Replacement rules. An empty array means that the original rule is fully disabled.
     */
    rules: DeclarativeRule[];

    /**
     * Exceptions whose scope cannot be represented by a CSP-only DNR rule.
     */
    unsupportedExceptions: Rule[];
};

/**
 * Rebuilds grouped CSP DNR rules after applying CSP-specific allowlist rules.
 */
export class CspExceptionPlanner {
    /**
     * Checks whether a declarative rule appends a Content-Security-Policy header.
     *
     * @param rule Declarative rule to inspect.
     *
     * @returns `true` when the rule modifies the CSP response header.
     */
    public static isCspRule(rule: DeclarativeRule): boolean {
        return rule.action.responseHeaders?.some((header) => header.header === CSP_HEADER_NAME) ?? false;
    }

    /**
     * Applies CSP allowlist rules to source rules represented by a grouped DNR rule.
     *
     * @param declarativeRule Grouped CSP DNR rule.
     * @param sourceRules Positive CSP source rules associated with the DNR rule.
     * @param cspAllowlistRules CSP allowlist rules from enabled filters.
     *
     * @returns CSP replacement rules and unsupported exceptions.
     */
    public static plan(
        declarativeRule: DeclarativeRule,
        sourceRules: Rule[],
        cspAllowlistRules: Rule[],
    ): CspExceptionPlan {
        if (!CspExceptionPlanner.isCspRule(declarativeRule)) {
            return { rules: [declarativeRule], unsupportedExceptions: [] };
        }

        const cspSourceRules = sourceRules.filter((rule) => {
            return !rule.allowlist
                && rule.isModifierEnabled(CSP_MODIFIER_NAME)
                && rule.advancedModifierValue !== null;
        });

        if (cspSourceRules.length === 0) {
            return { rules: [declarativeRule], unsupportedExceptions: [] };
        }

        const exceptions = cspAllowlistRules.filter((rule) => {
            return rule.allowlist && rule.isModifierEnabled(CSP_MODIFIER_NAME);
        });
        const unsupportedExceptions: Rule[] = [];

        const rules = cspSourceRules.flatMap((sourceRule) => {
            const cspValue = sourceRule.advancedModifierValue;

            if (cspValue === null) {
                return [];
            }

            const applicableExceptions = exceptions.filter((exception) => {
                return CspExceptionPlanner.matchesCspValue(sourceRule, exception)
                    && exception.priority >= sourceRule.priority;
            });

            if (applicableExceptions.some((exception) => CspExceptionPlanner.hasSameScope(sourceRule, exception))) {
                return [];
            }

            const excludedRequestDomains = applicableExceptions
                .map(CspExceptionPlanner.getExcludedRequestDomain)
                .filter((domain): domain is string => domain !== null);
            const unsupported = applicableExceptions.filter((exception) => {
                return CspExceptionPlanner.getExcludedRequestDomain(exception) === null;
            });
            unsupportedExceptions.push(...unsupported);

            return [CspExceptionPlanner.createReplacementRule(
                declarativeRule,
                cspValue,
                excludedRequestDomains,
            )];
        });

        return {
            rules,
            unsupportedExceptions: Array.from(new Set(unsupportedExceptions)),
        };
    }

    /**
     * Checks whether an exception applies to a CSP source value.
     *
     * @param sourceRule Positive CSP source rule.
     * @param exception CSP allowlist rule.
     *
     * @returns `true` if the exception applies to the complete CSP value.
     */
    private static matchesCspValue(sourceRule: Rule, exception: Rule): boolean {
        return exception.advancedModifierValue === null
            || exception.advancedModifierValue === sourceRule.advancedModifierValue;
    }

    /**
     * Checks whether two CSP rules have identical matching conditions.
     *
     * @param sourceRule Positive CSP source rule.
     * @param exception CSP allowlist rule.
     *
     * @returns `true` if the exception fully covers the source rule's scope.
     */
    private static hasSameScope(sourceRule: Rule, exception: Rule): boolean {
        return CspExceptionPlanner.getScopeKey(sourceRule) === CspExceptionPlanner.getScopeKey(exception);
    }

    /**
     * Creates a stable representation of a rule's DNR matching scope.
     *
     * @param rule CSP source or allowlist rule.
     *
     * @returns Stable scope key excluding the CSP value and allowlist marker.
     */
    private static getScopeKey(rule: Rule): string {
        const enabledModifiers = Array.from(rule.enabledModifiers)
            .filter((modifier) => modifier !== CSP_MODIFIER_NAME)
            .sort();

        return JSON.stringify({
            pattern: rule.pattern,
            enabledModifiers,
            disabledModifiers: Array.from(rule.disabledModifiers).sort(),
            permittedDomains: CspExceptionPlanner.sortValues(rule.permittedDomains),
            restrictedDomains: CspExceptionPlanner.sortValues(rule.restrictedDomains),
            permittedToDomains: CspExceptionPlanner.sortValues(rule.permittedToDomains),
            restrictedToDomains: CspExceptionPlanner.sortValues(rule.restrictedToDomains),
            denyAllowDomains: CspExceptionPlanner.sortValues(rule.denyAllowDomains),
            permittedResourceTypes: CspExceptionPlanner.sortValues(rule.permittedResourceTypes),
            restrictedResourceTypes: CspExceptionPlanner.sortValues(rule.restrictedResourceTypes),
            permittedMethods: CspExceptionPlanner.sortValues(rule.permittedMethods),
            restrictedMethods: CspExceptionPlanner.sortValues(rule.restrictedMethods),
            headerMatcher: rule.headerMatcher,
        });
    }

    /**
     * Sorts an optional list for stable matching-scope serialization.
     *
     * @param values Values to sort.
     *
     * @returns Sorted values or `null`.
     */
    private static sortValues<T>(values: readonly T[] | null): readonly T[] | null {
        return values === null ? null : [...values].sort();
    }

    /**
     * Gets a request domain that can be subtracted from a DNR condition.
     *
     * @param exception CSP allowlist rule.
     *
     * @returns Domain for `excludedRequestDomains`, or `null` when the exception is not domain-only.
     */
    private static getExcludedRequestDomain(exception: Rule): string | null {
        const enabledModifiers = Array.from(exception.enabledModifiers)
            .filter((modifier) => modifier !== CSP_MODIFIER_NAME);
        const domainMatch = exception.pattern.match(DOMAIN_EXCEPTION_PATTERN);

        if (
            !domainMatch
            || enabledModifiers.length > 0
            || exception.disabledModifiers.size > 0
            || exception.permittedDomains !== null
            || exception.restrictedDomains !== null
            || exception.permittedToDomains !== null
            || exception.restrictedToDomains !== null
            || exception.denyAllowDomains !== null
            || exception.permittedResourceTypes.length > 0
            || exception.restrictedResourceTypes.length > 0
            || exception.permittedMethods !== null
            || exception.restrictedMethods !== null
            || exception.headerMatcher !== null
        ) {
            return null;
        }

        const [, domain] = domainMatch;
        return domain.toLowerCase();
    }

    /**
     * Creates a single-source replacement for a grouped CSP DNR rule.
     *
     * @param declarativeRule Grouped CSP DNR rule.
     * @param cspValue Complete CSP value from the source rule.
     * @param excludedRequestDomains Domains excluded by CSP allowlist rules.
     *
    * @returns Replacement declarative rule.
    *
    * @throws {Error} When the source rule is missing its CSP response header.
     */
    private static createReplacementRule(
        declarativeRule: DeclarativeRule,
        cspValue: string,
        excludedRequestDomains: string[],
    ): DeclarativeRule {
        const replacement = JSON.parse(JSON.stringify(declarativeRule)) as DeclarativeRule;
        const { responseHeaders } = replacement.action;

        if (!responseHeaders) {
            throw new Error('CSP declarative rule does not contain response headers.');
        }

        const cspHeader = responseHeaders.find((header) => header.header === CSP_HEADER_NAME);
        if (!cspHeader) {
            throw new Error('CSP declarative rule does not contain a CSP response header.');
        }

        cspHeader.value = cspValue;

        if (excludedRequestDomains.length > 0) {
            replacement.condition.excludedRequestDomains = Array.from(new Set([
                ...(replacement.condition.excludedRequestDomains ?? []),
                ...excludedRequestDomains,
            ])).sort();
        }

        return replacement;
    }
}
