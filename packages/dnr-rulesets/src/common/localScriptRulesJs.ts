import crypto from 'node:crypto';

import type { JsInjectionRule } from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import {
    type ExportNamedDeclaration,
    parse,
    type Property,
    type SpreadElement,
    type VariableDeclaration,
} from 'acorn';
import { minify } from 'terser';

import { LocalScriptRulesBase } from './localScriptRulesBase';

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
        const formattedRules = this.formatRules(rules);

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
     * Deserializes local script rules from JS module content.
     * Parses the ES6 module and extracts script bodies from the exported object keys.
     *
     * NOTE: it's very important to properly extract not whole function with wrap,
     * but just the script body content to prevent multiple function wrapping.
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

        // Extract keys from the object, because keys are the needed script
        // bodies (not function wrappers)
        for (const property of properties) {
            if (property.type !== 'Property'
                || property.key.type !== 'Literal'
                || !('value' in property.key)
                || typeof property.key.value !== 'string') {
                this.logger.warn('Skipping invalid local script rule key', { property });
                continue;
            }

            const scriptBody = property.key.value;
            rules.add(scriptBody);
        }

        return rules;
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
