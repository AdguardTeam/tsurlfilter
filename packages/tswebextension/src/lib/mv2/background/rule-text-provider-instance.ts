import { type RuleTextProvider } from '../../common/utils/rule-text-provider';

/**
 * Lazy RuleTextProvider implementation that can be initialized after EngineApi is created.
 * This breaks the circular dependency between StealthApi and EngineApi.
 */
class LazyRuleTextProvider implements RuleTextProvider {
    private delegate: RuleTextProvider | null = null;

    /**
     * Initializes the provider with the actual EngineApi implementation.
     *
     * @param provider The actual RuleTextProvider implementation (typically EngineApi).
     */
    public initialize(provider: RuleTextProvider): void {
        this.delegate = provider;
    }

    /**
     * Retrieves the applied rule text.
     * Returns null if not yet initialized or if rule text is not found.
     *
     * @param filterId - Filter ID.
     * @param ruleIndex - Rule index.
     *
     * @returns Rule text or null.
     */
    public retrieveRuleText(filterId: number, ruleIndex: number): string | null {
        return this.delegate?.retrieveRuleText(filterId, ruleIndex) ?? null;
    }

    /**
     * Retrieves the original rule text.
     * Returns null if not yet initialized or if rule text is not found.
     *
     * @param filterId - Filter ID.
     * @param ruleIndex - Rule index.
     *
     * @returns Original rule text or null.
     */
    public retrieveOriginalRuleText(filterId: number, ruleIndex: number): string | null {
        return this.delegate?.retrieveOriginalRuleText(filterId, ruleIndex) ?? null;
    }
}

/**
 * Shared lazy rule text provider instance.
 * This is initialized after EngineApi is created to avoid circular dependencies.
 */
export const ruleTextProvider = new LazyRuleTextProvider();
