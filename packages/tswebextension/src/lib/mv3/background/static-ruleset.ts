import { type IRulesetWithSourceMap } from '@adguard/dnr-converter';

/**
 * Static rule set loaded from a rule set file bundled with the extension.
 */
export interface IStaticRuleset extends IRulesetWithSourceMap {
    /**
     * Returns the number of metadata rules at the beginning of the rule set
     * file. They carry the rule set metadata, are not counted by
     * {@link IRulesetWithSourceMap.getSafeRulesCount}, but take static rules
     * quota as any other rule of an enabled rule set.
     *
     * @returns Number of metadata rules.
     */
    getMetadataRulesCount(): number;
}
