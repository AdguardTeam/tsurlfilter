import crypto from 'node:crypto';

import type { JsInjectionRule } from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import {
    type ExportNamedDeclaration,
    type FunctionExpression,
    parse,
    type Property,
    type SpreadElement,
    type TryStatement,
    type VariableDeclaration,
} from 'acorn';
import { minify } from 'terser';

import { LocalScriptRulesBase } from './local-script-rules-base';

/**
 * Handles local script rules for MV3 extensions.
 * Extracts and manages JS injection rules in JavaScript module format.
 *
 * The primary purpose is to enable runtime checking of JS rules to determine
 * whether a rule comes from built-in filters or is a custom rule.
 */
export class LocalScriptRulesJs extends LocalScriptRulesBase {
    /**
     * Filename for the local script rules JS file.
     */
    public static readonly FILENAME = 'local_script_rules.js';

    /**
     * Validates JavaScript code as an ES6 module.
     *
     * @param code JavaScript code to validate.
     *
     * @throws Error if code is invalid JavaScript.
     */
    private validateModule(code: string): void {
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
    private validateScript(code: string): void {
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
    private calculateUniqueId(text: string): string {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    /**
     * Wraps the script code with a try-catch block and a check to avoid multiple executions.
     *
     * @param uniqueId Unique ID for the script.
     * @param code Script code.
     *
     * @returns Wrapped script code.
     */
    private wrapScriptCode(uniqueId: string, code: string): string {
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

        return wrappedCode.trim();
    }

    /**
     * Parses filter rules and extracts JS injection rules.
     *
     * @param filterRules Array of filter rule strings.
     *
     * @returns Set of extracted JS rule bodies.
     */
    public parse(filterRules: string[]): Set<string> {
        const rules = new Set<string>();
        const filterStr = filterRules.join('\n');

        // Need raw text for error reporting
        const filterListNode = this.parseFilterList(filterStr, true);

        // Extract only JS injection rules (excludes scriptlets)
        filterListNode.children.forEach((ruleNode) => {
            if (!this.isJsInjectionRule(ruleNode)) {
                return;
            }

            try {
                const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode as JsInjectionRule);

                // Validate that rule is valid javascript
                this.validateModule(rawBody);

                rules.add(rawBody);
            } catch (error) {
                // Invalid rules are skipped, but we log the error
                this.logger.error(`Error parsing script rule: ${ruleNode.raws?.text}`, error);
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
    public async serialize(rules: Set<string>): Promise<string> {
        // Deduplicate rules that differ only in whitespace
        const deduplicatedRules = await this.deduplicateRules(rules);

        const formattedRules = this.formatRules(deduplicatedRules);

        const rawContent = `export const localScriptRules = {
            ${formattedRules.join('\n')}
        };`;

        const { code: beautifiedJsContent } = await minify(
            rawContent,
            {
                mangle: false,
                compress: false,
                format: {
                    beautify: true,
                    comments: true,
                    indent_level: 4,
                },
            },
        );

        if (!beautifiedJsContent) {
            throw new Error('Failed to beautify JS content');
        }

        // Final validation of the complete file
        this.validateModule(beautifiedJsContent);

        return beautifiedJsContent;
    }

    /**
     * Deduplicates rules that differ only in whitespace/formatting.
     * Uses terser normalization to identify duplicates, but keeps original formatting.
     *
     * @param rules Set of script bodies to deduplicate.
     *
     * @returns Set of deduplicated script bodies (in their original formatting).
     */
    private async deduplicateRules(rules: Set<string>): Promise<Set<string>> {
        const unique = new Map<string, string>(); // normalized -> original
        let skippedCount = 0;

        for (const rule of rules) {
            try {
                // Try to normalize for comparison
                const result = await minify(rule, {
                    mangle: false,
                    compress: false,
                    format: {
                        beautify: true,
                        comments: true,
                    },
                });

                const normalized = result.code?.trim() || rule;

                // If we haven't seen this normalized form, keep this rule
                if (!unique.has(normalized)) {
                    unique.set(normalized, rule);
                } else {
                    skippedCount++;
                    this.logger.debug(
                        `Skipping duplicate rule (differs only in whitespace): ${rule.substring(0, 50)}...`,
                    );
                }
            } catch (error) {
                // If normalization fails, treat the rule as unique (use original as key)
                this.logger.warn(`Normalization failed for rule: ${rule.substring(0, 100)}`, { error });
                if (!unique.has(rule)) {
                    unique.set(rule, rule);
                }
            }
        }

        if (skippedCount > 0) {
            this.logger.info(`Deduplicated ${skippedCount} rules that differed only in whitespace`);
        }

        // Return the original formatting of unique rules
        return new Set(unique.values());
    }

    /**
     * Deserializes local script rules from JS module content.
     * Parses the ES6 module and extracts script bodies from the function bodies.
     *
     * NOTE: We extract from function bodies (not keys) because acorn interprets
     * escape sequences in string literal keys, losing the original formatting.
     * The function body contains the actual script that executes, which is the
     * source of truth.
     *
     * @param content JS module content string.
     *
     * @returns Set of JS rule bodies extracted from the module.
     */
    public async deserialize(content: string): Promise<Set<string>> {
        const rules = new Set<string>();

        const ast = parse(content, {
            ecmaVersion: 'latest',
            sourceType: 'module',
        });

        // List of functions defined in the exported object.
        let properties: (Property | SpreadElement)[] = [];

        // Since serialization is implemented in this class, we expect the
        // module to have a specific structure, otherwise parsing will fail.
        try {
            const exportedNamedDeclarator = ast.body[0] as ExportNamedDeclaration;
            const variableDeclaration = exportedNamedDeclarator.declaration as VariableDeclaration;
            const declarator = variableDeclaration.declarations[0];
            const init = declarator.init;
            if (!init || init.type !== 'ObjectExpression') {
                throw new Error('localScriptRules is not an object expression');
            }
            properties = init.properties;
        } catch (e) {
            throw new Error('Failed to parse local script rules', { cause: e });
        }

        // Extract script bodies from function bodies, not from keys.
        // Keys may have escape sequences interpreted by acorn, losing original formatting.
        for (const property of properties) {
            if (property.type !== 'Property') {
                this.logger.warn('Skipping non-property in local script rules', { property });
                continue;
            }

            // Get the function value
            const func = property.value;
            if (func.type !== 'FunctionExpression' && func.type !== 'ArrowFunctionExpression') {
                this.logger.warn('Skipping property with non-function value', { property });
                continue;
            }

            try {
                // Extract the script body from the wrapped function
                const scriptBody = this.extractScriptFromWrappedFunction(func as FunctionExpression, content);
                if (!scriptBody) {
                    throw new Error(`Cannot extract script body from function expression: ${content.slice(0, 100)}`);
                }

                // Normalize the extracted script to ensure it can be re-serialized
                // (beautified code with newlines can't be used as object keys)
                const normalized = await this.normalizeScript(scriptBody);
                rules.add(normalized);
            } catch (error) {
                this.logger.warn('Failed to extract script body from function', { error, property });
            }
        }

        return rules;
    }

    /**
     * Normalizes a script body to a single-line, minified form.
     * This ensures extracted scripts can be re-serialized as object keys.
     *
     * @param scriptBody The script body to normalize.
     *
     * @returns Normalized script body.
     */
    private async normalizeScript(scriptBody: string): Promise<string> {
        try {
            // Use compact format (no beautify) to ensure single-line output
            const result = await minify(scriptBody, {
                mangle: false,
                compress: false,
                format: {
                    beautify: false, // Keep compact for use as object keys
                    comments: false, // Remove comments to keep compact
                },
            });

            return result.code?.trim() || scriptBody;
        } catch {
            // If normalization fails, return original
            return scriptBody;
        }
    }

    /**
     * Extracts the original script body from a wrapped function.
     *
     * The wrapped structure is an arrow function containing a try-catch block
     * with the original script "sandwiched" between setup and cleanup code.
     *
     * @param func The function expression containing the wrapped script.
     * @param source Original source code (for extracting text by position).
     *
     * @returns The extracted script body, or null if extraction fails.
     */
    private extractScriptFromWrappedFunction(
        func: FunctionExpression,
        source: string,
    ): string | null {
        // Navigate: function body -> first statement (try-catch) -> try block
        const funcBody = func.body;
        if (funcBody.type !== 'BlockStatement' || funcBody.body.length === 0) {
            return null;
        }

        const firstStatement = funcBody.body[0];
        if (firstStatement.type !== 'TryStatement') {
            return null;
        }

        const tryStatement = firstStatement as TryStatement;
        const tryBlock = tryStatement.block;
        if (tryBlock.body.length < 4) {
            // Need at least: flag declaration, if statement, script, Object.defineProperty
            return null;
        }

        // The structure is:
        // [0] const flag = "done";
        // [1] if (Window.prototype.toString["<id>"] === flag) { return; }
        // [2..n-1] <ORIGINAL_SCRIPT_BODY>
        // [n] Object.defineProperty(...)

        const statements = tryBlock.body;
        const scriptStatements = statements.slice(2, -1);

        if (scriptStatements.length === 0) {
            return null;
        }

        // Extract source code from the first to last script statement
        const firstScriptStmt = scriptStatements[0];
        const lastScriptStmt = scriptStatements[scriptStatements.length - 1];

        if (!firstScriptStmt.start || !lastScriptStmt.end) {
            return null;
        }

        // Extract the raw source code for these statements
        const scriptBody = source.substring(firstScriptStmt.start, lastScriptStmt.end).trim();

        return scriptBody;
    }

    /**
     * Extends existing rules with new rules.
     *
     * @param existing Set of existing JS rule bodies.
     * @param newRules Set of new JS rule bodies to add.
     *
     * @returns Merged set of all rules.
     */
    public extend(existing: Set<string>, newRules: Set<string>): Set<string> {
        const merged = new Set(existing);

        newRules.forEach((rule) => merged.add(rule));

        return merged;
    }

    /**
     * Wraps a single rule with error handling and execution protection.
     *
     * @param rule Script code.
     *
     * @returns Wrapped script code or null if validation fails.
     */
    private wrapRule(rule: string): string | null {
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
            const uniqueId = this.calculateUniqueId(rule);

            // Wrap the code with a try-catch block with extra checking to avoid multiple executions
            const processedCode = this.wrapScriptCode(uniqueId, rule);

            // Validate the processed code (will be inside function body, so allow return)
            this.validateScript(processedCode);

            return `'${ruleKey}': () => { ${processedCode} },`;
        } catch (error) {
            this.logger.error(`Skipping invalid rule during production processing: ${rule}`, error);
        }

        return null;
    }

    /**
     * Formats JS rules with double execution protection and error handling.
     *
     * @param scriptRules Set of script rules to process.
     *
     * @returns Formatted rules as strings.
     */
    private formatRules(scriptRules: Set<string>): string[] {
        return Array.from(scriptRules.values())
            .map((rule) => this.wrapRule(rule))
            .filter((rule): rule is string => rule !== null);
    }
}
