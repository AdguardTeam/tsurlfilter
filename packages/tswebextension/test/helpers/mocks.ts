import type { RuleTextProvider } from '../../src/lib/common/utils/rule-text-provider';

/**
 * Mock implementation of RuleTextProvider for testing.
 * Returns null for all rule text retrieval attempts.
 */
export const mockEngineApi: RuleTextProvider = {
    retrieveRuleText: (): string | null => null,
    retrieveOriginalRuleText: (): string | null => null,
};
