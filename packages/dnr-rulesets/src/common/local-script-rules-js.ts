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
     * Placeholder marker for inserting new rules without AST parsing.
     */
    private static readonly INSERT_PLACEHOLDER = '/* #INSERT_NEW_RULES_HERE# */';

    /**
     * Indentation level for the local script rules JS file.
     */
    private static readonly IDENT_LEVEL = 4;

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
     * Wraps the content in an object.
     *
     * @param content Content to wrap.
     *
     * @returns Content wrapped in an object.
     */
    private static wrapInObject(content: string): string {
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
     * Minifies JS content with Terser.
     *
     * @param content JS content to minify.
     *
     * @returns Minified JS content.
     */
    private static async minifyJsContent(content: string): Promise<string> {
        const { code } = await minify(content, {
            mangle: false,
            compress: false,
            format: {
                beautify: true,
                comments: true,
                indent_level: LocalScriptRulesJs.IDENT_LEVEL,
            },
        });

        if (!code) {
            throw new Error('Failed to minify JS content');
        }

        return code;
    }

    /**
     * Inserts the placeholder into the content.
     *
     * @param content JS content to insert placeholder into.
     *
     * @returns Content with placeholder inserted.
     */
    private static async insertPlaceholder(content: string): Promise<string> {
        // Insert placeholder marker after minification, Terser strips standalone
        // comments, so we must add it after beautification.
        // Search for the closing bracket from the end of the file.
        const lastBraceIndex = content.lastIndexOf('}');
        if (lastBraceIndex === -1) {
            throw new Error('Could not find closing brace in beautified content');
        }

        // Little hack to prevent inserting comma into zero-rules file
        const emptyContent = await LocalScriptRulesJs.minifyJsContent(LocalScriptRulesJs.wrapInObject(''));

        // Special case handling for empty content
        const isEmptyContent = content === emptyContent;

        // Insert placeholder before the closing brace
        const beforeClosingBrace = content
            .slice(0, lastBraceIndex)
            .trimEnd();
        const indentation = ' '.repeat(LocalScriptRulesJs.IDENT_LEVEL);

        const contentWithPlaceholder = [
            beforeClosingBrace,
            // If content is empty we should not insert comma before the placeholder
            isEmptyContent ? '\n' : ',\n',
            `${indentation}${LocalScriptRulesJs.INSERT_PLACEHOLDER}`,
            '\n',
            content.slice(lastBraceIndex),
        ].join('');

        return contentWithPlaceholder;
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

        // Placeholder cannot be inserted before minification because Terser
        // strips standalone comments in all cases
        // Note: No indentation in template literal - Terser will handle all formatting
        const rawContent = LocalScriptRulesJs.wrapInObject(wrappedRules.join('\n'));

        const beautifiedJsContent = await LocalScriptRulesJs.minifyJsContent(rawContent);

        // Beautification will remove comment with placeholder, so we need to add it back
        const contentWithPlaceholder = await LocalScriptRulesJs.insertPlaceholder(beautifiedJsContent);

        // Final validation of the complete file
        LocalScriptRulesJs.validateModule(contentWithPlaceholder);

        return contentWithPlaceholder;
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
        // Find the placeholder position
        const placeholderIndex = existingContent.indexOf(LocalScriptRulesJs.INSERT_PLACEHOLDER);
        if (placeholderIndex === -1) {
            throw new Error(`Placeholder "${LocalScriptRulesJs.INSERT_PLACEHOLDER}" not found.`);
        }

        const newRules = LocalScriptRulesJs.parse(newRuleStrings);
        const wrappedNewRules = LocalScriptRulesJs.wrapRules(newRules);

        // Insert new rules before the placeholder (which is before the closing brace)
        // Find the start of the line containing the placeholder to preserve indentation
        const lineStart = existingContent.lastIndexOf('\n', placeholderIndex - 1) + 1;

        // Each rule should be indented to match the existing formatting
        const newRulesContent = wrappedNewRules
            .map((rule) => `${' '.repeat(LocalScriptRulesJs.IDENT_LEVEL)}${rule}`)
            .join('\n');

        // Insert new rules before the placeholder
        const updatedContent = [
            existingContent.slice(0, lineStart),
            newRulesContent,
            '\n',
            existingContent.slice(lineStart),
        ].join('');

        // Beautify the updated content
        const beautifiedJsContent = await LocalScriptRulesJs.minifyJsContent(updatedContent);

        // Beautification will remove comment with placeholder, so we need to add it back
        const contentWithPlaceholder = await LocalScriptRulesJs.insertPlaceholder(beautifiedJsContent);

        // Validate the updated content
        LocalScriptRulesJs.validateModule(contentWithPlaceholder);

        return contentWithPlaceholder;
    }
}
