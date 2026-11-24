import { CSP_HEADER_NAME } from '../constants';
import { type DeclarativeRule, type ModifyHeaderInfo, RuleActionType } from '../declarative-rule';
import { type Rule } from '../rule/rule';

import { type ConvertedRules } from './converted-rules';
import { RegularRuleConverter } from './regular-rule-converter';

/**
 * Checks whether a declarative rule appends a CSP response header.
 *
 * @param rule Declarative rule to check.
 *
 * @returns `true` for CSP declarative rules.
 */
export function isCspDeclarativeRule(rule: DeclarativeRule): boolean {
    return rule.action.type === RuleActionType.ModifyHeaders
        && rule.action.responseHeaders?.some(({ header }) => header === CSP_HEADER_NAME) === true;
}

/**
 * Describes how to convert `$csp` rules.
 *
 * @see {@link RegularRuleConverter} parent class.
 */
export class CspConverter extends RegularRuleConverter {
    /**
     * Creates a CSP converter.
     *
     * @param webAccessibleResourcesPath Path to web-accessible resources.
     * @param excludedRequestDomains Request domains excluded from source rules.
     */
    constructor(
        webAccessibleResourcesPath?: string,
        private readonly excludedRequestDomains: Map<Rule, string[]> = new Map(),
    ) {
        super(webAccessibleResourcesPath);
    }

    /**
     * Converts one CSP rule and applies domains produced by the resolver.
     *
     * @param id Rule ID.
     * @param rule Source CSP rule.
     *
     * @returns Converted DNR rule.
     */
    protected override async convertRule(id: number, rule: Rule): Promise<DeclarativeRule> {
        const declarativeRule = await super.convertRule(id, rule);
        const domains = this.excludedRequestDomains.get(rule);

        if (domains && domains.length > 0) {
            declarativeRule.condition.excludedRequestDomains = Array.from(new Set([
                ...(declarativeRule.condition.excludedRequestDomains ?? []),
                ...domains,
            ]));
        }

        return declarativeRule;
    }

    /**
     * Creates rule template for grouping similar `$csp` rules.
     *
     * @param rule {@link DeclarativeRule} to create template from.
     *
     * @returns Stringified rule template.
     */
    private static createRuleTemplate(rule: DeclarativeRule): string {
        /**
         * Deep copy to drop references to source rule.
         *
         * Note: `Partial` type is used because we need to delete some fields,
         * but we cannot mark them as optional in the parent type.
         */
        const template: Partial<DeclarativeRule> = JSON.parse(JSON.stringify(rule));

        /**
         * Remove ID field from the template as it is unique
         * per rule and should not be used for grouping.
         * Also remove value of the CSP header as they
         * may differ between rules but still should be grouped together.
         *
         * Note: Converted `$csp` rules contain only one response headers action.
         */
        delete template.id;
        delete template.action?.responseHeaders?.[0].value;

        return JSON.stringify(template);
    }

    /**
     * Finds CSP header in the provided header info.
     *
     * @param modifyHeaderInfo Modify header info to check.
     *
     * @returns `true` if the header is CSP header, `false` otherwise.
     */
    private static isCspHeader(modifyHeaderInfo: ModifyHeaderInfo) {
        return modifyHeaderInfo.header === CSP_HEADER_NAME;
    }

    /**
     * Splits a CSP header value into directives.
     *
     * @param value CSP header value.
     *
     * @returns Non-empty trimmed directives.
     */
    private static splitDirectives(value: string): string[] {
        return value
            .split(';')
            .map((directive) => directive.trim())
            .filter((directive) => directive.length > 0);
    }

    /**
     * Returns the lowercased directive name.
     *
     * Directive names are case-insensitive, while directive values are not, so
     * only the name is lowercased.
     *
     * @param directive CSP directive.
     *
     * @returns Lowercased directive name.
     */
    private static getDirectiveName(directive: string): string {
        const [name] = directive.split(/\s/, 1);

        return name.toLowerCase();
    }

    /**
     * Returns the arguments of a CSP directive.
     *
     * @param directive CSP directive.
     *
     * @returns Arguments as written, or an empty string for a value-less directive.
     */
    private static getDirectiveArguments(directive: string): string {
        const match = /^\S+\s+(.*)$/.exec(directive);

        return match ? match[1] : '';
    }

    /**
     * Collects the CSP header value of a declarative rule.
     *
     * @param rule Declarative rule.
     *
     * @returns CSP header value or `null` if the rule has no CSP header.
     */
    private static getCspValue(rule: DeclarativeRule): string | null {
        const header = rule.action.responseHeaders?.find(CspConverter.isCspHeader);

        return header?.value ?? null;
    }

    /**
     * Checks whether two CSP header values express the same policy.
     *
     * Merged directives form a single policy, so merging different ones can
     * change what is blocked through the `default-src` fallback:
     * `default-src 'none'` plus `script-src 'self'` in one header allow
     * same-origin scripts, while the same directives in two headers block
     * them, because a browser applies every header of the response. Two
     * identical policies, on the other hand, are applied once either way, so
     * only such values are merged.
     *
     * @param currentValue Current CSP header value.
     * @param valueToMerge CSP header value to append.
     *
     * @returns `true` if the values express the same policy.
     */
    private static canMergeCspValues(currentValue: string, valueToMerge: string): boolean {
        const currentArguments = CspConverter.mapDirectiveArguments(currentValue);
        const mergeArguments = CspConverter.mapDirectiveArguments(valueToMerge);

        if (currentArguments.size !== mergeArguments.size) {
            return false;
        }

        for (const [name, args] of mergeArguments) {
            if (currentArguments.get(name) !== args) {
                return false;
            }
        }

        return true;
    }

    /**
     * Lists the directives of a CSP header value with their arguments.
     *
     * @param value CSP header value.
     *
     * @returns Arguments by lowercased directive name.
     */
    private static mapDirectiveArguments(value: string): Map<string, string> {
        const argumentsByName = new Map<string, string>();

        CspConverter.splitDirectives(value).forEach((directive) => {
            const name = CspConverter.getDirectiveName(directive);
            if (!argumentsByName.has(name)) {
                argumentsByName.set(name, CspConverter.getDirectiveArguments(directive));
            }
        });

        return argumentsByName;
    }

    /**
     * Combines two similar `$csp` {@link DeclarativeRule}
     * rules into one when they carry the same policy.
     *
     * @param sourceRule The source rule to merge into.
     * @param ruleToMerge The rule to merge into the source rule.
     *
     * @returns The combined {@link DeclarativeRule}, or `null` if the two rules
     * carry different policies and must stay separate.
     */
    private static combineRulePair(
        sourceRule: DeclarativeRule,
        ruleToMerge: DeclarativeRule,
    ): DeclarativeRule | null {
        // Deep copy to drop references to source rule
        const resultRule: DeclarativeRule = JSON.parse(JSON.stringify(sourceRule));

        // If the headers are empty in the rule to merge, do not take any action
        const { responseHeaders: headersToMerge } = ruleToMerge.action;
        if (!headersToMerge || headersToMerge.length === 0) {
            return resultRule;
        }

        // Try to find CSP header in the rule to merge - if not found, do not take any action
        let cspHeaderInfoToMerge = headersToMerge.find(CspConverter.isCspHeader);
        if (!cspHeaderInfoToMerge) {
            return resultRule;
        }

        const currentValue = CspConverter.getCspValue(resultRule);
        if (currentValue !== null
            && cspHeaderInfoToMerge.value !== undefined
            && !CspConverter.canMergeCspValues(currentValue, cspHeaderInfoToMerge.value)) {
            return null;
        }

        // Deep copy to avoid reference issues
        cspHeaderInfoToMerge = JSON.parse(JSON.stringify(cspHeaderInfoToMerge)) as ModifyHeaderInfo;

        /**
         * Check if the headers are empty in the result rule:
         * - if `true` - try to add CSP header if it exists in the result rule;
         * - if `false` - create new response headers array with only CSP header.
         */
        const { responseHeaders: resultHeaders } = resultRule.action;
        if (resultHeaders && resultHeaders.length > 0) {
            // Try to find CSP header in the result rule - if not found, do not take any action
            const cspHeaderIndex = resultHeaders.findIndex(CspConverter.isCspHeader);
            if (cspHeaderIndex === -1) {
                return resultRule;
            }

            // Only identical policies reach this point, so a set value is kept.
            if (!resultHeaders[cspHeaderIndex].value) {
                resultHeaders[cspHeaderIndex].value = cspHeaderInfoToMerge.value;
            }
        } else {
            resultRule.action.responseHeaders = [cspHeaderInfoToMerge];
        }

        return resultRule;
    }

    /**
     * Groups converted `$csp` rules by merging rules with identical conditions.
     *
     * @param converted Converted rules before grouping.
     *
     * @returns Converted rules after grouping.
     */
    // eslint-disable-next-line class-methods-use-this -- template method override
    protected override groupConverted(converted: ConvertedRules): ConvertedRules {
        return RegularRuleConverter.groupConvertedRules(
            converted,
            CspConverter.createRuleTemplate,
            CspConverter.combineRulePair,
        );
    }
}
