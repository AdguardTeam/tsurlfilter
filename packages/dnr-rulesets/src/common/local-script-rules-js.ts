import crypto from 'node:crypto';

import type { JsInjectionRule } from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import { parse } from 'acorn';
import { minify } from 'terser';

import { logger } from '../utils/logger';
import { isJsInjectionRule, parseFilterList } from './local-script-rules-base';

/**
 * Handles local script rules in JS module format.
 *
 * This format is primarily used for Manifest V3 where it is highly recommended
 * to provide local script rules. If not provided during build, all
 * script rules (except scriptlets) will not be injected to ensure compliance
 * with Chrome Web Store policies.
 *
 * The primary purpose is to enable runtime checking of JS rules to determine
 * whether a rule comes from built-in filters or is a custom rule.
 *
 * NOTE: Script rules are NOT deduplicated. It is critical to keep script rules
 * exactly as they were parsed from the filter rules because they will be
 * checked in runtime as-is to verify their origin.
 */
export class LocalScriptRulesJs {
    /**
     * Filename for the local script rules JS file.
     */
    public static readonly FILENAME = 'local_script_rules.js';

    /**
     * Placeholder property marker for inserting new rules without AST parsing.
     * Using a property instead of a comment ensures it survives beautification.
     * Note: Terser removes quotes from valid identifier property names.
     */
    private static readonly PLACEHOLDER_MARKER = '__PLACEHOLDER__: () => {}';

    /**
     * Indentation level for the local script rules JS file.
     */
    private static readonly INDENT_LEVEL = 4;

    /**
     * Validates JavaScript code as an ES6 module.
     *
     * @param code JavaScript code to validate.
     *
     * @throws Error if code is invalid JavaScript.
     */
    private static validateModule(code: string): void {
        parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
        });
    }

    /**
     * Validates JavaScript code as a script (allows return statements outside functions).
     *
     * @param code JavaScript code to validate.
     *
     * @throws Error if code is invalid JavaScript.
     */
    private static validateScript(code: string): void {
        parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'script',
            allowReturnOutsideFunction: true,
        });
    }

    /**
     * Calculates unique ID for the text.
     *
     * @param text Text to calculate unique ID for.
     *
     * @returns Unique ID.
     */
    private static calculateUniqueId(text: string): string {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    /**
     * Escapes a string for use as a JavaScript string literal.
     *
     * @param str String to escape.
     *
     * @returns Escaped string.
     */
    private static escapeJsString(str: string): string {
        return str
            .replace(/\\/g, '\\\\') // Backslash must be first
            .replace(/'/g, '\\\'') // Single quote
            .replace(/\n/g, '\\n') // Newline
            .replace(/\r/g, '\\r') // Carriage return
            .replace(/\t/g, '\\t'); // Tab
    }

    /**
     * Wraps the content in an named export.
     *
     * @param content Content to wrap.
     *
     * @returns Content wrapped in named export.
     */
    private static wrapInNamedExport(content: string): string {
        return `export const localScriptRules = {\n${content}\n};`;
    }

    /**
     * Wraps the script code with a try-catch block and a check to avoid multiple executions.
     *
     * @param uniqueId Unique ID for the script.
     * @param code Script code.
     *
     * @returns Wrapped script code.
     */
    private static wrapScriptCode(uniqueId: string, code: string): string {
        const wrappedCode = `
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
`;

        return wrappedCode;
    }

    /**
     * Wraps a single rule with error handling and execution protection.
     *
     * @param rule Script code.
     *
     * @returns Wrapped script code or null if validation fails.
     */
    private static wrapRule(rule: string): string | null {
        try {
            // Escape all special characters for JavaScript string literal
            const ruleKey = LocalScriptRulesJs.escapeJsString(rule);

            /**
             * Unique ID is needed to prevent multiple execution of the same script.
             *
             * It may happen when script rules are being applied on WebRequest.onResponseStarted
             * and WebNavigation.onCommitted events which are independent of each other,
             * so we need to make sure that the script is executed only once.
             */
            const uniqueId = LocalScriptRulesJs.calculateUniqueId(rule);

            // Wrap the code with a try-catch block with extra checking to avoid multiple executions
            const processedCode = LocalScriptRulesJs.wrapScriptCode(uniqueId, rule);

            // Validate the processed code (will be inside function body, so allow return)
            LocalScriptRulesJs.validateScript(processedCode);

            // Always include trailing comma for valid syntax with placeholder
            return `'${ruleKey}': () => { ${processedCode} },`;
        } catch (error) {
            logger.error(`Skipping invalid rule during production processing: ${rule}`, error);
        }

        return null;
    }

    /**
     * Wraps JS rules with double execution protection and error handling.
     *
     * @param scriptRules Set of script rules to process.
     *
     * @returns Wrapped rules as strings.
     */
    private static wrapRules(scriptRules: Set<string>): string[] {
        return Array.from(scriptRules.values())
            .map((rule) => LocalScriptRulesJs.wrapRule(rule))
            .filter((rule): rule is string => rule !== null);
    }

    /**
     * Beautifies JS content with Terser.
     *
     * @param content JS content to beautify.
     *
     * @returns Beautified JS content.
     */
    private static async beautifyJsContent(content: string): Promise<string> {
        const { code } = await minify(content, {
            mangle: false,
            compress: false,
            format: {
                beautify: true,
                comments: true,
                indent_level: LocalScriptRulesJs.INDENT_LEVEL,
            },
        });

        if (!code) {
            throw new Error('Failed to beautify JS content');
        }

        return code;
    }

    /**
     * Parses filter rules and extracts JS injection rules.
     *
     * @param filterRules Array of filter rule strings.
     *
     * @returns Set of extracted JS rule bodies.
     */
    public static parse(filterRules: string[]): Set<string> {
        const rules = new Set<string>();
        const filterStr = filterRules.join('\n');

        // Need raw text for error reporting
        const filterListNode = parseFilterList(filterStr, true);

        // Extract only JS injection rules (excludes scriptlets)
        filterListNode.children.forEach((ruleNode) => {
            if (!isJsInjectionRule(ruleNode)) {
                return;
            }

            try {
                const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode as JsInjectionRule);

                // Validate that rule is valid javascript
                LocalScriptRulesJs.validateModule(rawBody);

                rules.add(rawBody);
            } catch (error) {
                // Invalid rules are skipped, but we log the error
                logger.error(`Error parsing script rule: ${ruleNode.raws?.text}`, error);
            }
        });

        return rules;
    }

    /**
     * Serializes JS rules into a formatted ES6 module string.
     *
     * @param rules Set of JS rule bodies.
     *
     * @returns Serialized and beautified rules as an ES6 module export string.
     */
    public static async serialize(rules: Set<string>): Promise<string> {
        const wrappedRules = LocalScriptRulesJs.wrapRules(rules);

        // Add placeholder marker at the end for future extensions
        // Using a property (not a comment) ensures it survives beautification
        const rulesWithMarker = [...wrappedRules, LocalScriptRulesJs.PLACEHOLDER_MARKER];

        // Build raw content - Terser will handle all formatting
        const rawContent = LocalScriptRulesJs.wrapInNamedExport(rulesWithMarker.join('\n'));

        // Beautify once at the end
        const beautifiedContent = await LocalScriptRulesJs.beautifyJsContent(rawContent);

        // Validate the complete file
        LocalScriptRulesJs.validateModule(beautifiedContent);

        return beautifiedContent;
    }

    /**
     * Extends a JS file content with new rules by inserting them before the placeholder.
     * This avoids the need for AST deserialization, making extension much faster.
     *
     * @param existingContent Existing JS module content.
     * @param newRuleStrings Array of new filter rule strings to parse and add.
     *
     * @returns Updated JS module content with new rules inserted.
     */
    public static async extend(existingContent: string, newRuleStrings: string[]): Promise<string> {
        // Parse new rules
        const newRules = LocalScriptRulesJs.parse(newRuleStrings);
        if (newRules.size === 0) {
            return existingContent;
        }

        // Find and replace the placeholder marker with new rules + placeholder
        const placeholderIndex = existingContent.indexOf(LocalScriptRulesJs.PLACEHOLDER_MARKER);
        if (placeholderIndex === -1) {
            throw new Error(`Placeholder marker not found in existing content.`);
        }

        // Build replacement: new rules followed by the marker
        const wrappedNewRules = LocalScriptRulesJs.wrapRules(newRules);
        const rulesWithMarker = [...wrappedNewRules, LocalScriptRulesJs.PLACEHOLDER_MARKER];

        // Replace the marker with new rules + marker
        const updatedContent = existingContent.replace(
            LocalScriptRulesJs.PLACEHOLDER_MARKER,
            rulesWithMarker.join('\n'),
        );

        // Beautify the updated content once at the end
        const beautifiedContent = await LocalScriptRulesJs.beautifyJsContent(updatedContent);

        // Validate the updated content
        LocalScriptRulesJs.validateModule(beautifiedContent);

        return beautifiedContent;
    }
}
