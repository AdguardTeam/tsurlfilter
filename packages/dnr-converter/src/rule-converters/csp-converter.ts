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
     * Appends CSP directives that are not present in the current value yet.
     *
     * Identical repeated `$csp` rules must not duplicate their directives in
     * the merged header value.
     *
     * @param currentValue Current CSP header value.
     * @param valueToMerge CSP header value to append.
     *
     * @returns Merged CSP header value.
     */
    private static mergeCspValues(currentValue: string, valueToMerge: string): string {
        const splitDirectives = (value: string) => value
            .split(';')
            .map((directive) => directive.trim())
            .filter((directive) => directive.length > 0);

        const directives = splitDirectives(currentValue);
        const knownDirectives = new Set(directives);

        splitDirectives(valueToMerge).forEach((directive) => {
            if (!knownDirectives.has(directive)) {
                knownDirectives.add(directive);
                directives.push(directive);
            }
        });

        return directives.join('; ');
    }

    /**
     * Combines two similar `$csp` {@link DeclarativeRule}
     * rules into one by merging their CSP header values.
     *
     * @param sourceRule The source rule to merge into.
     * @param ruleToMerge The rule to merge into the source rule.
     *
     * @returns The combined {@link DeclarativeRule}.
     */
    private static combineRulePair(sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule): DeclarativeRule {
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

            /**
             * Check if the CSP header value is already set in the result rule:
             * - if `true` - append value from the rule to merge;
             * - if `false` - set value from the rule to merge.
             */
            const cspHeaderValue = resultHeaders[cspHeaderIndex].value;
            if (cspHeaderValue && cspHeaderInfoToMerge.value) {
                resultHeaders[cspHeaderIndex].value = CspConverter.mergeCspValues(
                    cspHeaderValue,
                    cspHeaderInfoToMerge.value,
                );
            } else {
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
