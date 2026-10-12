import fs from 'node:fs/promises';

import {
    Filter,
    FilterConverter,
    type IRulesetWithSourceMap,
    parseCompactRuleset,
    RulesetWithSourceMap,
} from '@adguard/dnr-converter';

/**
 * Loads ruleset and filter.
 *
 * @param rulesetPath Path to the ruleset.
 * @param id String id (e.g., '999').
 *
 * @returns Promise with loaded Ruleset (as IRulesetWithSourceMap).
 *
 * @throws Error naming the file if it cannot be read, parsed or rebuilt; the
 * cause is e.g. `InvalidMetadataChunksError` for a file written by
 * `@adguard/dnr-converter` 1.x or `UnavailableRulesetSourceError` for
 * metadata of an invalid shape. Rulesets are loaded concurrently, so the path
 * tells which one is broken.
 */
export async function loadRulesetAndFilter(
    rulesetPath: string,
    id: string,
): Promise<IRulesetWithSourceMap> {
    const filterId = Number(id);
    const rulesetId = FilterConverter.getRulesetId(filterId);

    try {
        const rulesetRaw = await fs.readFile(rulesetPath, 'utf8');

        // Leading metadata rules are joined and parsed by the converter; only the
        // ordinary rules come back in `declarativeRules`.
        const content = parseCompactRuleset(rulesetId, JSON.parse(rulesetRaw));
        const ruleset = RulesetWithSourceMap.fromCompact(
            rulesetId,
            content,
            [new Filter(filterId, content.filterContent)],
        );

        console.log(`Loaded ruleset with ID ${id} from ${rulesetPath}`);

        return ruleset;
    } catch (e: unknown) {
        throw new Error(`Cannot load ruleset from ${rulesetPath}`, { cause: e });
    }
}
