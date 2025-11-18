import { promises as fs } from 'node:fs';

import type { AnyRule, CosmeticRule, FilterList } from '@adguard/agtree';
import { CosmeticRuleType, RuleCategory } from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';
import { defaultParserOptions, FilterListParser } from '@adguard/agtree/parser';
import { Logger } from '@adguard/logger';
import * as acorn from 'acorn';
import path from 'path';
import { minify } from 'terser';

import {
    extractJsRules,
    formatRules,
    LOCAL_SCRIPT_RULES_JS_FILENAME,
    LOCAL_SCRIPT_RULES_JSON_FILENAME,
} from '../src/common/local-script-utils';

const NEWLINE = '\n';

const FILTER_FILE_PREFIX = 'filter_';
const FILTER_FILE_EXTENSION = '.txt';

/**
 * Domain configuration for a script rule.
 */
export type DomainConfig = {
    /**
     * List of domains where the script should be applied.
     */
    permittedDomains: string[];
    /**
     * List of domains where the script should NOT be applied.
     */
    restrictedDomains: string[];
};

/**
 * Map of script bodies to their domain configurations.
 */
export type ScriptRulesWithDomainsMap = Map<string, DomainConfig[]>;

/**
 * JSON structure for local script rules.
 */
type LocalScriptRulesJson = {
    /**
     * Comment describing the local script rules.
     */
    comment: string;
    /**
     * Map of script bodies (as keys) to their domain configurations.
     */
    rules: {
        [key: string]: DomainConfig[];
    };
};

/**
 * Create a logger instance.
 */
const logger = new Logger();

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
 * Extracts domain configuration from a cosmetic rule node.
 *
 * @param ruleNode Cosmetic rule node with domains.
 *
 * @returns Domain configuration with permitted and restricted domains.
 */
const extractDomainConfig = (ruleNode: CosmeticRule): DomainConfig => {
    const permittedDomains: string[] = [];
    const restrictedDomains: string[] = [];

    ruleNode.domains.children.forEach((domainNode) => {
        if (domainNode.exception) {
            restrictedDomains.push(domainNode.value);
        } else {
            permittedDomains.push(domainNode.value);
        }
    });

    return {
        permittedDomains,
        restrictedDomains,
    };
};

/**
 * Checks if a domain config is a duplicate using deep comparison.
 *
 * @param config Config to check.
 * @param existingConfigs Array of existing configs.
 *
 * @returns True if config already exists.
 */
const isDuplicateConfig = (config: DomainConfig, existingConfigs: DomainConfig[]): boolean => {
    const configStr = JSON.stringify(config);
    return existingConfigs.some((existing) => JSON.stringify(existing) === configStr);
};

/**
 * Reads all filter_*.txt files from a directory.
 *
 * @param dir Directory to read from.
 *
 * @returns Array of filter file names.
 */
const getFilterFiles = async (dir: string): Promise<string[]> => {
    const files = await fs.readdir(dir);
    return files.filter((file) => {
        return file.startsWith(FILTER_FILE_PREFIX) && file.endsWith(FILTER_FILE_EXTENSION);
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
 * Serializes and validates the processed rules.
 *
 * @param processedRules Array of processed rules.
 *
 * @returns Serialized and validated rules as an ES6 module export.
 */
export const serializedAndValidate = async (processedRules: string[]): Promise<string> => {
    const rawContent = `export const localScriptRules = {
        ${processedRules.join(NEWLINE)}
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
    validateModule(beautifiedJsContent);

    return beautifiedJsContent;
};

/**
 * Extracts JS rules with domain information from a filter file.
 *
 * @param filterStr Filter file content.
 *
 * @returns Map of script bodies to their domain configurations.
 */
export const extractJsRulesWithDomains = (filterStr: string): ScriptRulesWithDomainsMap => {
    const rulesMap: ScriptRulesWithDomainsMap = new Map();

    // Parse the filter list using agtree parser
    const filterListNode = parseFilterList(filterStr, false);

    // Extract only JS injection rules (excludes scriptlets)
    filterListNode.children.forEach((ruleNode) => {
        if (!isJsInjectionRule(ruleNode)) {
            return;
        }

        try {
            // Re-generate raw body to make it consistent
            const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode);

            const domainConfig = extractDomainConfig(ruleNode);

            if (!rulesMap.has(rawBody)) {
                rulesMap.set(rawBody, [domainConfig]);
            } else {
                const existing = rulesMap.get(rawBody)!;
                if (!isDuplicateConfig(domainConfig, existing)) {
                    existing.push(domainConfig);
                }
            }
        } catch (error) {
            const fullRule = ruleNode.raws?.text || 'unknown rule';
            logger.error(`Error parsing script rule with domains: ${fullRule}`, error);
        }
    });

    return rulesMap;
};

/**
 * Creates a JSON file with domain information for Firefox.
 *
 * @param dir Directory containing filter files.
 */
export const createLocalScriptRulesJson = async (dir: string): Promise<void> => {
    const txtFiles = await getFilterFiles(dir);
    const allRules: ScriptRulesWithDomainsMap = new Map();

    // Collect rules from all filter files
    for (const file of txtFiles) {
        const filterStr = await fs.readFile(path.join(dir, file), 'utf-8');
        const rulesMap = extractJsRulesWithDomains(filterStr);

        // Merge into allRules
        rulesMap.forEach((configs, scriptBody) => {
            const existing = allRules.get(scriptBody);
            if (!existing) {
                allRules.set(scriptBody, configs);
                return;
            }

            configs.forEach((config) => {
                if (!isDuplicateConfig(config, existing)) {
                    existing.push(config);
                }
            });
        });
    }

    // Convert Map to object for JSON
    const rulesObject: LocalScriptRulesJson['rules'] = {};

    allRules.forEach((configs, scriptBody) => {
        rulesObject[scriptBody] = configs;
    });

    /* eslint-disable max-len */
    const jsonOutput: LocalScriptRulesJson = {
        comment: 'By the rules of AMO, we cannot use remote scripts (and our JS rules can be counted as such).\n'
            + 'Because of that, we use the following approach (that was accepted by AMO reviewers):\n\n'
            + '1. We pre-build JS rules from AdGuard filters into the add-on (see the file called "local_script_rules.json").\n'
            + '2. At runtime we check every JS rule if it is included into "local_script_rules.json".\n'
            + '   If it is included we allow this rule to work since it is pre-built. Other rules are discarded.\n'
            + '3. We also allow "User rules" and "Custom filters" to work since those rules are added manually by the user.\n'
            + '   This way filters maintainers can test new rules before including them in the filters.',
        rules: rulesObject,
    };
    /* eslint-enable max-len */

    await fs.writeFile(
        path.join(dir, LOCAL_SCRIPT_RULES_JSON_FILENAME),
        JSON.stringify(jsonOutput, null, 4),
    );

    logger.info(`Created ${LOCAL_SCRIPT_RULES_JSON_FILENAME} with ${allRules.size} unique rules`);
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
 * Reads filters from the directory, extracts JS rules from files starting with filter_ and ending with .txt,
 * and saves them to a JS file in the same directory.
 *
 * Creates a JS file for Chromium MV3 with execution protection.
 *
 * @param dir Directory containing filter files.
 */
export const createLocalScriptRulesJs = async (dir: string): Promise<void> => {
    const files = await getFilterFiles(dir);
    const jsRules = new Set<string>();

    for (const file of files) {
        const filterStr = await fs.readFile(path.join(dir, file), 'utf-8');
        const rules = extractJsRules(filterStr);
        rules.forEach((rule) => {
            jsRules.add(rule);
        });
    }

    const formattedRules = formatRules(jsRules);

    const serializedRules = await serializedAndValidate(formattedRules);

    await fs.writeFile(path.join(dir, LOCAL_SCRIPT_RULES_JS_FILENAME), serializedRules);

    logger.info(`Created ${LOCAL_SCRIPT_RULES_JS_FILENAME} with ${jsRules.size} unique rules`);
};
