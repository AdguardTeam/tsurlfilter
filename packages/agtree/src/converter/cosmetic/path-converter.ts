/**
 * @file Path-in-domain converter helper
 */

import {
    type AnyCosmeticRule,
    type AnyRule,
    ListItemNodeType,
    ListNodeType,
} from '../../nodes';
import { AdblockSyntax } from '../../utils/adblockers';
import { clone } from '../../utils/clone';
import { COMMA, SLASH, ADG_PATH_MODIFIER } from '../../utils/constants';
import { createModifierNode } from '../../ast-utils/modifiers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';

/**
 * Converts path-in-domain syntax to $path modifier.
 *
 * Example: `example.org/path##.ad` → `[$path=/path]example.org##.ad`
 *
 * @param rule Rule to check and convert.
 *
 * @returns Conversion result if path-in-domain syntax found, undefined otherwise.
 *
 * @throws RuleConversionError if conflicting $path modifier exists.
 */
export function convertPathInDomainToModifier(
    rule: AnyCosmeticRule,
): NodeConversionResult<AnyRule> | undefined {
    // Only process rules with domains
    if (!rule.domains || rule.domains.children.length === 0) {
        return undefined;
    }

    // Check if any domain contains a path (has '/' character)
    // Note: The parser does not split domains correctly when they contain paths,
    // so we need to handle comma-separated domains within a single domain value
    const domainsWithPaths: Array<{ domain: string; path: string; exception: boolean }> = [];
    const domainsWithoutPaths: Array<{ domain: string; exception: boolean }> = [];

    rule.domains.children.forEach((domainItem) => {
        const domainValue = domainItem.value;

        // Check if this domain value contains commas (multiple domains in one string)
        if (domainValue.includes(COMMA)) {
            const parts = domainValue.split(COMMA);
            parts.forEach((part) => {
                const trimmedPart = part.trim();
                const slashIndex = trimmedPart.indexOf(SLASH);

                if (slashIndex !== -1) {
                    const domain = trimmedPart.substring(0, slashIndex);
                    const path = trimmedPart.substring(slashIndex);
                    domainsWithPaths.push({
                        domain,
                        path,
                        exception: domainItem.exception,
                    });
                } else {
                    domainsWithoutPaths.push({
                        domain: trimmedPart,
                        exception: domainItem.exception,
                    });
                }
            });
        } else {
            // Single domain value
            const slashIndex = domainValue.indexOf(SLASH);

            if (slashIndex !== -1) {
                // Domain contains path
                const domain = domainValue.substring(0, slashIndex);
                const path = domainValue.substring(slashIndex); // includes leading /

                domainsWithPaths.push({
                    domain,
                    path,
                    exception: domainItem.exception,
                });
            } else {
                // Domain without path
                domainsWithoutPaths.push({
                    domain: domainValue,
                    exception: domainItem.exception,
                });
            }
        }
    });

    if (domainsWithPaths.length === 0) {
        return undefined;
    }

    // Check for conflicting $path modifier
    if (rule.modifiers) {
        const hasPathModifier = rule.modifiers.children.some(
            (mod) => mod.name.value === ADG_PATH_MODIFIER,
        );
        if (hasPathModifier) {
            throw new RuleConversionError('Path specified both in domain and $path modifier');
        }
    }

    // Group domains by path
    const pathGroups = new Map<string, Array<{ domain: string; exception: boolean }>>();

    domainsWithPaths.forEach(({ domain, path, exception }) => {
        if (!pathGroups.has(path)) {
            pathGroups.set(path, []);
        }
        pathGroups.get(path)!.push({ domain, exception });
    });

    // If all domains have the same path and there are no domains without paths,
    // create a single rule with $path modifier
    if (pathGroups.size === 1 && domainsWithoutPaths.length === 0) {
        const [path, domains] = Array.from(pathGroups.entries())[0];
        const convertedRule = clone(rule);

        // Set syntax to Adg since we're adding AdGuard modifiers
        convertedRule.syntax = AdblockSyntax.Adg;

        // Update domains to remove paths
        convertedRule.domains = {
            type: ListNodeType.DomainList,
            separator: rule.domains.separator,
            children: domains.map((d) => ({
                type: ListItemNodeType.Domain,
                value: d.domain,
                exception: d.exception,
            })),
        };

        // Add $path modifier
        const pathModifier = createModifierNode(ADG_PATH_MODIFIER, path);

        if (convertedRule.modifiers) {
            convertedRule.modifiers = {
                ...convertedRule.modifiers,
                children: [...convertedRule.modifiers.children, pathModifier],
            };
        } else {
            convertedRule.modifiers = {
                type: 'ModifierList' as const,
                children: [pathModifier],
            };
        }

        return createNodeConversionResult([convertedRule], true);
    }

    // Multiple paths or mixed (with/without paths) - split into multiple rules
    const convertedRules: AnyCosmeticRule[] = [];

    // Create rules for domains with paths
    pathGroups.forEach((domains, path) => {
        const convertedRule = clone(rule);

        // Set syntax to Adg since we're adding AdGuard modifiers
        convertedRule.syntax = AdblockSyntax.Adg;

        // Set domains for this path
        convertedRule.domains = {
            type: 'DomainList' as const,
            separator: rule.domains!.separator,
            children: domains.map((d) => ({
                type: 'Domain' as const,
                value: d.domain,
                exception: d.exception,
            })),
        };

        // Add $path modifier
        const pathModifier = createModifierNode(ADG_PATH_MODIFIER, path);

        if (convertedRule.modifiers) {
            convertedRule.modifiers = {
                ...convertedRule.modifiers,
                children: [...convertedRule.modifiers.children, pathModifier],
            };
        } else {
            convertedRule.modifiers = {
                type: 'ModifierList' as const,
                children: [pathModifier],
            };
        }

        convertedRules.push(convertedRule);
    });

    // Create rule for domains without paths (if any)
    if (domainsWithoutPaths.length > 0) {
        const convertedRule = clone(rule);

        convertedRule.domains = {
            type: 'DomainList' as const,
            separator: rule.domains!.separator,
            children: domainsWithoutPaths.map((d) => ({
                type: 'Domain' as const,
                value: d.domain,
                exception: d.exception,
            })),
        };

        convertedRules.push(convertedRule);
    }

    return createNodeConversionResult(convertedRules, true);
}
