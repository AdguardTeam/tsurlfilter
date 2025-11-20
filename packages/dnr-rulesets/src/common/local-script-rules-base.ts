import type { AnyRule, FilterList } from '@adguard/agtree';
import { CosmeticRuleType, RuleCategory } from '@adguard/agtree';
import { defaultParserOptions, FilterListParser } from '@adguard/agtree/parser';
import { Logger } from '@adguard/logger';

/**
 * Abstract base class for local script rules handling.
 * Contains shared protected methods for parsing and processing script rules.
 */
export abstract class LocalScriptRulesBase {
    /**
     * Logger instance for error reporting.
     */
    protected readonly logger: Logger;

    /**
     * Creates an instance of LocalScriptRulesBase.
     */
    constructor() {
        this.logger = new Logger();
    }

    /**
     * Parses a filter list string into an AST.
     *
     * @param filterStr Filter list content.
     * @param includeRaws Whether to include raw text in parsed nodes.
     *
     * @returns Parsed filter list node.
     */
    protected parseFilterList(filterStr: string, includeRaws: boolean = false): FilterList {
        return FilterListParser.parse(filterStr, {
            ...defaultParserOptions,
            includeRaws,
            isLocIncluded: false,
            tolerant: true,
        });
    }

    /**
     * Checks if a rule node is a JS injection rule.
     *
     * @param ruleNode Rule node to check.
     *
     * @returns True if the rule node is a JS injection rule, false otherwise.
     */
    protected isJsInjectionRule(ruleNode: AnyRule): boolean {
        return ruleNode.category === RuleCategory.Cosmetic
            && ruleNode.type === CosmeticRuleType.JsInjectionRule;
    }
}
