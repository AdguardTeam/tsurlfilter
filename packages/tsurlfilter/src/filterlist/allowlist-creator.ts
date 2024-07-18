import { OutputByteBuffer, RuleParser } from '@adguard/agtree';
import { BufferRuleList } from './buffer-rule-list';
import { createAllowlistRuleNode } from '../rules/allowlist';

/**
 * Creates a list of allowlist rules for a given list ID and domains.
 *
 * @param listId List ID.
 * @param domains List of domains to create allowlist rules for.
 * @returns BufferRuleList instance.
 */
export const createAllowlistRuleList = (listId: number, domains: string[]): BufferRuleList => {
    const buffer = new OutputByteBuffer();

    domains.forEach((domain) => {
        const rule = createAllowlistRuleNode(domain);

        if (rule) {
            RuleParser.serialize(rule, buffer);
        }
    });

    // TODO (David): Remove any cast
    return new BufferRuleList(listId, (buffer as any).chunks);
};
