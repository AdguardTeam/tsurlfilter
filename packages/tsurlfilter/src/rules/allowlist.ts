import { type NetworkRule, NetworkRuleType, RuleCategory } from '@adguard/agtree';
import { AdblockSyntax } from '@adguard/agtree/utils';

import { SimpleRegex } from './simple-regex';

/**
 * Helper function to create an allowlist rule node for a given domain.
 *
 * @param domain Domain to create an allowlist rule for.
 *
 * @returns Allowlist rule node or null.
 */
export const createAllowlistRuleNode = (domain: string): null | NetworkRule => {
    const domainToUse = domain.startsWith('www.') ? domain.substring(4) : domain;

    if (!domainToUse) {
        return null;
    }

    let pattern: string;

    // Special case: Wildcard TLD + N domain
    if (domainToUse.startsWith('*.')) {
        pattern = `${SimpleRegex.MASK_START_URL}${domainToUse.slice(2)}`;
    } else {
        // In other cases we use regexp to match domain and it`s 'www' subdomain strictly.
        let regexp = '';

        // transform allowlist domain special characters
        for (let i = 0; i < domainToUse.length; i += 1) {
            const char = domainToUse[i];

            // transform wildcard to regexp equivalent
            if (char === '*') {
                regexp += '.*';
            // escape domain separator
            } else if (char === '.') {
                regexp += String.raw`\.`;
            } else {
                regexp += char;
            }
        }

        pattern = String.raw`///(www\.)?${regexp}/`;
    }

    const node: NetworkRule = {
        category: RuleCategory.Network,
        type: NetworkRuleType.NetworkRule,
        syntax: AdblockSyntax.Common,
        exception: true,
        pattern: {
            type: 'Value',
            value: pattern,
        },
        modifiers: {
            type: 'ModifierList',
            children: [
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'document',
                    },
                },
                {
                    type: 'Modifier',
                    name: {
                        type: 'Value',
                        value: 'important',
                    },
                },
            ],
        },
    };

    return node;
};
