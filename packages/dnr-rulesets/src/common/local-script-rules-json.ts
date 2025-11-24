import type { CosmeticRule, JsInjectionRule } from '@adguard/agtree';
import { CosmeticRuleBodyGenerator } from '@adguard/agtree/generator';

import { logger } from '../utils/logger';
import { isJsInjectionRule, parseFilterList } from './local-script-rules-base';

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
 * JSON structure for local script rules.
 */
type LocalScriptRulesJsonStructure = {
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
 * Handles local script rules in JSON format with domain configurations.
 *
 * This format is used for Manifest V2 extensions. If not provided, all
 * script rules are allowed.
 * Should be provided in Firefox AMO according to their policies.
 *
 * The primary purpose is to enable runtime checking of JS rules to determine
 * whether a rule comes from built-in filters or is a custom rule.
 */
export class LocalScriptRulesJson {
    /**
     * Filename for the local script rules JSON file.
     */
    public static readonly FILENAME = 'local_script_rules.json';

    /* eslint-disable max-len */
    /**
     * Default comment for the JSON file explaining the AMO compliance approach.
     */
    private static readonly DEFAULT_COMMENT = 'By the rules of AMO, we cannot use remote scripts (and our JS rules can be counted as such).\n'
        + 'Because of that, we use the following approach (that was accepted by AMO reviewers):\n\n'
        + '1. We pre-build JS rules from AdGuard filters into the add-on (see the file called "local_script_rules.json").\n'
        + '2. At runtime we check every JS rule if it is included into "local_script_rules.json".\n'
        + '   If it is included we allow this rule to work since it is pre-built. Other rules are discarded.\n'
        + '3. We also allow "User rules" and "Custom filters" to work since those rules are added manually by the user.\n'
        + '   This way filters maintainers can test new rules before including them in the filters.';
    /* eslint-enable max-len */

    /**
     * Extracts domain configuration from a cosmetic rule node.
     *
     * @param ruleNode Cosmetic rule node with domains.
     *
     * @returns Domain configuration with permitted and restricted domains.
     */
    public static extractDomainConfig(ruleNode: CosmeticRule): DomainConfig {
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
    }

    /**
     * Checks if a domain config is a duplicate using deep comparison.
     *
     * @param config Config to check.
     * @param existingConfigs Array of existing configs.
     *
     * @returns True if config already exists.
     */
    public static isDuplicateConfig(config: DomainConfig, existingConfigs: DomainConfig[]): boolean {
        const configStr = JSON.stringify(config);
        return existingConfigs.some((existing) => JSON.stringify(existing) === configStr);
    }

    /**
     * Parses filter rules and extracts JS injection rules with domain information.
     *
     * @param filterRules Array of filter rule strings.
     *
     * @returns Map of script bodies to their domain configurations.
     */
    public static parse(filterRules: string[]): Map<string, DomainConfig[]> {
        const rulesMap: Map<string, DomainConfig[]> = new Map();
        const filterStr = filterRules.join('\n');

        // Parse the filter list using agtree parser
        const filterListNode = parseFilterList(filterStr, false);

        // Extract only JS injection rules (excludes scriptlets)
        filterListNode.children.forEach((ruleNode) => {
            if (!isJsInjectionRule(ruleNode)) {
                return;
            }

            try {
                // Re-generate raw body to make it consistent
                const rawBody = CosmeticRuleBodyGenerator.generate(ruleNode as JsInjectionRule);

                const domainConfig = LocalScriptRulesJson.extractDomainConfig(ruleNode as JsInjectionRule);

                const existing = rulesMap.get(rawBody);
                if (!existing) {
                    rulesMap.set(rawBody, [domainConfig]);
                } else if (!LocalScriptRulesJson.isDuplicateConfig(domainConfig, existing)) {
                    existing.push(domainConfig);
                }
            } catch (error) {
                const fullRule = ruleNode.raws?.text || 'unknown rule';
                logger.error(`Error parsing script rule with domains: ${fullRule}`, error);
            }
        });

        return rulesMap;
    }

    /**
     * Serializes rules map into a formatted JSON string.
     *
     * @param rules Map of script bodies to their domain configurations.
     *
     * @returns Serialized JSON string.
     */
    public static serialize(rules: Map<string, DomainConfig[]>): string {
        // Convert Map to object for JSON
        const rulesObject: LocalScriptRulesJsonStructure['rules'] = {};

        rules.forEach((configs, scriptBody) => {
            rulesObject[scriptBody] = configs;
        });

        const jsonOutput: LocalScriptRulesJsonStructure = {
            comment: LocalScriptRulesJson.DEFAULT_COMMENT,
            rules: rulesObject,
        };

        return JSON.stringify(jsonOutput, null, 4);
    }

    /**
     * Deserializes local script rules from JSON content.
     *
     * @param content JSON content string.
     *
     * @returns Map of script bodies to their domain configurations.
     */
    public static deserialize(content: string): Map<string, DomainConfig[]> {
        const jsonData: LocalScriptRulesJsonStructure = JSON.parse(content);
        const rulesMap: Map<string, DomainConfig[]> = new Map();

        Object.entries(jsonData.rules).forEach(([scriptBody, configs]) => {
            rulesMap.set(scriptBody, configs);
        });

        return rulesMap;
    }

    /**
     * Extends existing rules with new rules, merging domain configurations.
     *
     * @param existing Map of existing script bodies to their domain configurations.
     * @param newRules Map of new script bodies to their domain configurations.
     *
     * @returns Merged map of all rules with combined domain configurations.
     */
    public static extend(
        existing: Map<string, DomainConfig[]>,
        newRules: Map<string, DomainConfig[]>,
    ): Map<string, DomainConfig[]> {
        const merged = new Map(existing);

        newRules.forEach((configs, scriptBody) => {
            const existingConfigs = merged.get(scriptBody);

            if (!existingConfigs) {
                // Add new script rule
                merged.set(scriptBody, configs);
                return;
            }

            // If script already exists, merge domain configs
            configs.forEach((config) => {
                if (!LocalScriptRulesJson.isDuplicateConfig(config, existingConfigs)) {
                    existingConfigs.push(config);
                }
            });
        });

        return merged;
    }
}
