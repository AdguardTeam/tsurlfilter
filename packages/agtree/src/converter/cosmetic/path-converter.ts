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
import {
    CLOSE_SQUARE_BRACKET,
    ESCAPE_CHARACTER,
    OPEN_SQUARE_BRACKET,
    REGEX_MARKER,
    SLASH,
    ADG_PATH_MODIFIER,
} from '../../utils/constants';
import { createModifierNode } from '../../ast-utils/modifiers';
import { RuleConversionError } from '../../errors/rule-conversion-error';
import { type NodeConversionResult, createNodeConversionResult } from '../base-interfaces/conversion-result';

/**
 * Finds the index of the first escaped forward slash (`\/`) in a regex string,
 * skipping character classes (`[...]`).
 *
 * @param str Regex content without outer `/` delimiters.
 *
 * @returns Index of the backslash in the first `\/` sequence, or -1 if not found.
 */
function findFirstEscapedSlash(str: string): number {
    let insideCharacterClass = false;

    for (let i = 0; i < str.length; i += 1) {
        if (str[i] === OPEN_SQUARE_BRACKET && !insideCharacterClass) {
            insideCharacterClass = true;
        } else if (str[i] === CLOSE_SQUARE_BRACKET && insideCharacterClass) {
            insideCharacterClass = false;
        } else if (
            !insideCharacterClass
            && str[i] === ESCAPE_CHARACTER
            && i + 1 < str.length
            && str[i + 1] === SLASH
        ) {
            return i;
        }
    }

    return -1;
}

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

    // Quick check: return early if no domain contains a path indicator.
    // For non-regex domains, a path requires '/'.
    // For regex domains, a path requires '\/' (escaped slash).
    const hasAnyPath = rule.domains.children.some((domainItem) => {
        const { value } = domainItem;
        if (value.startsWith(REGEX_MARKER) && value.endsWith(REGEX_MARKER) && value.length > 1) {
            return value.includes(ESCAPE_CHARACTER + SLASH);
        }
        return value.includes(SLASH);
    });

    if (!hasAnyPath) {
        return undefined;
    }

    const domainsWithPaths: Array<{ domain: string; path: string; exception: boolean }> = [];
    const domainsWithoutPaths: Array<{ domain: string; exception: boolean }> = [];

    rule.domains.children.forEach((domainItem) => {
        const domainValue = domainItem.value;

        // Check if domain is a regex pattern (starts and ends with /)
        if (domainValue.startsWith(REGEX_MARKER) && domainValue.endsWith(REGEX_MARKER) && domainValue.length > 1) {
            const inner = domainValue.slice(1, -1);
            const splitIndex = findFirstEscapedSlash(inner);

            if (splitIndex !== -1) {
                // splitIndex points to the backslash in `\/`
                // Domain part: everything before the backslash, wrapped in /
                // Path part: from the slash onward (keeping the slash), wrapped in /
                const domain = `${REGEX_MARKER}${inner.substring(0, splitIndex)}${REGEX_MARKER}`;
                const path = `${REGEX_MARKER}${inner.substring(splitIndex)}${REGEX_MARKER}`;

                domainsWithPaths.push({
                    domain,
                    path,
                    exception: domainItem.exception,
                });
            } else {
                domainsWithoutPaths.push({
                    domain: domainValue,
                    exception: domainItem.exception,
                });
            }
        } else {
            // Non-regex domain
            const slashIndex = domainValue.indexOf(SLASH);

            if (slashIndex !== -1) {
                const domain = domainValue.substring(0, slashIndex);
                const path = domainValue.substring(slashIndex); // includes leading /

                // Skip empty paths
                if (path === '/') {
                    domainsWithoutPaths.push({
                        domain,
                        exception: domainItem.exception,
                    });
                } else {
                    domainsWithPaths.push({
                        domain,
                        path,
                        exception: domainItem.exception,
                    });
                }
            } else {
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

    /*
     * Exception domains cannot be combined with path-in-domain syntax.
     *
     * For example example.org/foo1/bar2,~example.org/${WILDCARD}/bar2##h1
     * This can’t be converted because [$path=/${WILDCARD}/bar2]example.org##h1
     * may unblock unrelated rules like: "example.org/baz1/bar2##h1".
     */
    const hasException = rule.domains.children.some((d) => d.exception);
    if (hasException) {
        // Single exception domain with path — just skip conversion
        if (rule.domains.children.length === 1) {
            return undefined;
        }
        // Domain list with both exception and path-in-domain — error
        throw new RuleConversionError('Path-in-domain syntax cannot be used with exception domains');
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
                type: 'ModifierList',
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
            type: 'DomainList',
            separator: rule.domains!.separator,
            children: domains.map((d) => ({
                type: 'Domain',
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
                type: 'ModifierList',
                children: [pathModifier],
            };
        }

        convertedRules.push(convertedRule);
    });

    // Create rule for domains without paths (if any)
    if (domainsWithoutPaths.length > 0) {
        const convertedRule = clone(rule);

        convertedRule.domains = {
            type: 'DomainList',
            separator: rule.domains!.separator,
            children: domainsWithoutPaths.map((d) => ({
                type: 'Domain',
                value: d.domain,
                exception: d.exception,
            })),
        };

        convertedRules.push(convertedRule);
    }

    return createNodeConversionResult(convertedRules, true);
}
