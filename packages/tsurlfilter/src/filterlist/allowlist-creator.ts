import { OutputByteBuffer } from '@adguard/agtree';
import { RuleSerializer } from '@adguard/agtree/serializer';

import { createAllowlistRuleNode } from '../rules/allowlist';

import { BufferRuleList } from './buffer-rule-list';

/**
 * Creates a list of allowlist rules for a given list ID and domains.
 *
 * @param listId List ID.
 * @param domains List of domains to create allowlist rules for.
 *
 * @returns BufferRuleList instance.
 */
export const createAllowlistRuleList = (listId: number, domains: string[]): BufferRuleList => {
    const buffer = new OutputByteBuffer();

    domains.forEach((domain) => {
        const rule = createAllowlistRuleNode(domain);

        if (rule) {
            RuleSerializer.serialize(rule, buffer);
        }
    });

    return new BufferRuleList(listId, buffer.getChunks());
};
