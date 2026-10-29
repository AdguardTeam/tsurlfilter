import { type IRulesetWithSourceMap } from '@adguard/dnr-converter';

import { logger } from '../../common/utils/logger';

/**
 * Returns source rule ids of a declarative rule.
 *
 * `TooManyError.excludedRulesIds` contains source rule ids, so declarative ids
 * must be mapped through the rule set source map. If the source map is not
 * available, the declarative id is returned as is to keep the counts intact.
 *
 * @param ruleset Rule set the declarative rule belongs to.
 * @param declarativeRuleId Declarative rule id.
 *
 * @returns Source rule ids.
 */
export const getSourceRuleIds = async (
    ruleset: IRulesetWithSourceMap,
    declarativeRuleId: number,
): Promise<number[]> => {
    try {
        const sources = await ruleset.getSourceRuleIndexes(declarativeRuleId);

        if (sources.length === 0) {
            return [declarativeRuleId];
        }

        return sources.map(({ sourceRuleIndex }) => sourceRuleIndex);
    } catch (e) {
        logger.debug(
            '[tsweb.source-rule-ids]: Cannot map declarative rule:',
            declarativeRuleId,
            ruleset.getId(),
            e,
        );

        return [declarativeRuleId];
    }
};

/**
 * Maps a list of declarative rule ids to source rule ids.
 *
 * @param ruleset Rule set the declarative rules belong to, if known.
 * @param declarativeRuleIds Declarative rule ids.
 *
 * @returns Source rule ids.
 */
export const getSourceRuleIdsList = async (
    ruleset: IRulesetWithSourceMap | undefined,
    declarativeRuleIds: number[],
): Promise<number[]> => {
    if (!ruleset) {
        return declarativeRuleIds;
    }

    const ids = await Promise.all(
        declarativeRuleIds.map((id) => getSourceRuleIds(ruleset, id)),
    );

    return ids.flat();
};
