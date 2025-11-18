import crypto from 'node:crypto';

import type { AnyRule, FilterList } from '@adguard/agtree';
import { CosmeticRuleType, RuleCategory } from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import { defaultParserOptions, FilterListParser } from '@adguard/agtree/parser';
import { Logger } from '@adguard/logger';
import * as acorn from 'acorn';

/**
 * Create a logger instance.
 */
const logger = new Logger();

/**
 * Local script rules for the Chrome MV3 extension.
 */
export const LOCAL_SCRIPT_RULES_JS_FILENAME = 'local_script_rules.js';

/**
 * Local script rules for the Firefox extension.
 */
export const LOCAL_SCRIPT_RULES_JSON_FILENAME = 'local_script_rules.json';

/**
 * Parses a filter list string into an AST.
 *
 * @param filterStr Filter list content.
 * @param includeRaws Whether to include raw text in parsed nodes.
 *
 * @returns Parsed filter list node.
 */
const parseFilterList = (filterStr: string, includeRaws: boolean = false): FilterList => {
    return FilterListParser.parse(filterStr, {
        ...defaultParserOptions,
        includeRaws,
        isLocIncluded: false,
        tolerant: true,
    });
};

/**
 * Validates JavaScript code as an ES6 module.
 *
 * @param code JavaScript code to validate.
 *
 * @throws Error if code is invalid JavaScript.
 */
const validateModule = (code: string): void => {
    acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
    });
};

/**
 * Validates JavaScript code as a script (allows return statements outside functions).
 *
 * @param code JavaScript code to validate.
 *
 * @throws Error if code is invalid JavaScript.
 */
const validateScript = (code: string): void => {
    acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        allowReturnOutsideFunction: true,
    });
};

/**
 * Calculates unique ID for the text.
 *
 * @param text Text to calculate unique ID for.
 *
 * @returns Unique ID.
 */
export const calculateUniqueId = (text: string): string => {
    return crypto.createHash('md5').update(text).digest('hex');
};

/**
 * Wraps the script code with a try-catch block and a check to avoid multiple executions of it.
 *
 * @param uniqueId Unique ID for the script.
 * @param code Script code.
 *
 * @returns Wrapped script code.
 */
const wrapScriptCode = (uniqueId: string, code: string): string => {
    return `
try {
    const flag = 'done';
    if (Window.prototype.toString["${uniqueId}"] === flag) {
        return;
    }
    ${code}
    Object.defineProperty(Window.prototype.toString, "${uniqueId}", {
        value: flag,
        enumerable: false,
        writable: false,
        configurable: false
    });
} catch (error) {
    console.error('Error executing AG js rule with uniqueId "${uniqueId}" due to: ' + error);
}
`.trim();
};

/**
 * Wraps the script code with a try-catch block and a check to avoid multiple
 * executions of it.
 *
 * @param rule Script code.
 *
 * @returns Wrapped script code.
 */
export const wrapRule = (rule: string): string | null => {
    try {
    // Escape single quotes in the key
        const ruleKey = rule.replace(/'/g, '\\\'');

        /**
         * Unique ID is needed to prevent multiple execution of the same script.
         *
         * It may happen when script rules are being applied on WebRequest.onResponseStarted
         * and WebNavigation.onCommitted events which are independent of each other,
         * so we need to make sure that the script is executed only once.
         */
        const uniqueId = calculateUniqueId(rule);

        // Wrap the code with a try-catch block with extra checking to avoid multiple executions
        const processedCode = wrapScriptCode(uniqueId, rule);

        // Validate the processed code (will be inside function body, so allow return)
        validateScript(processedCode);

        return `'${ruleKey}': () => { ${processedCode} },`;
    } catch (error) {
        logger.error(
            `Skipping invalid rule during production processing: ${rule}`,
            error,
        );
    }

    return null;
};

/**
 * Formats JS rules with double execution protection and error handling.
 *
 * @param scriptRules Set of script rules to process.
 *
 * @returns Formatted and beautified rules as an ES6 module export.
 */
export const formatRules = (scriptRules: Set<string>): string[] => {
    return Array.from(scriptRules.values())
        .map((rule) => wrapRule(rule))
        .filter((rule) => rule !== null);
};

/**
 * Checks if a rule node is a JS injection rule.
 *
 * @param ruleNode Rule node to check.
 *
 * @returns True if the rule node is a JS injection rule, false otherwise.
 */
const isJsInjectionRule = (ruleNode: AnyRule) => {
    return ruleNode.category === RuleCategory.Cosmetic
        && ruleNode.type === CosmeticRuleType.JsInjectionRule;
};

/**
 * Extracts JS rules from a filter file.
 *
 * @param filterStr Filter file content.
 *
 * @returns Set of extracted JS rules.
 */
export const extractJsRules = (filterStr: string) => {
    const rules = new Set<string>();

    // Need raw text for error reporting
    const filterListNode = parseFilterList(filterStr, true);

    // Extract only JS injection rules (excludes scriptlets)
    filterListNode.children.forEach((ruleNode) => {
        if (!isJsInjectionRule(ruleNode)) {
            return;
        }

        try {
            const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode);

            // Validate that rule is valid javascript
            validateModule(rawBody);

            rules.add(rawBody);
        } catch (error) {
            // Invalid rules are skipped, but we log the error
            logger.error(`Error parsing script rule: ${ruleNode.raws?.text}`, error);
        }
    });

    return rules;
};
