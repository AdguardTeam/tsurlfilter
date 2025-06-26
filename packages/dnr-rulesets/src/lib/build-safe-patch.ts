import { convertFilters } from '@adguard/tsurlfilter/cli';
import { DeclarativeRule, SafetyPatch } from '@adguard/tsurlfilter/es/declarative-converter';
import { getRuleSetPath } from '@adguard/tsurlfilter/es/declarative-converter-utils';
import { promises as fs } from 'fs';
import { ensureDir } from 'fs-extra';
import path from 'path';

import { loadRuleSetAndFilterFromDir } from './ruleset-deserialize';

const SAFE_ACTIONS = new Set(['block', 'allow', 'allowAllRequests', 'upgradeScheme']);

/**
 * Options for the build safe patch function.
 */
interface BuildSafePatchOptions {
    /**
     * Path to the old ruleset directory.
     */
    oldDir: string;

    /**
     * Path to the new ruleset directory.
     */
    newDir: string;

    /**
     * Output folder for the patch files.
     */
    outDir: string;

    /**
     * Path to the resources directory.
     * This is used to build $redirect rules.
     */
    resourcesPath: string;

    /**
     * Defines whether to prettify the rulesets JSON or not.
     * Not prettifying can save on JSON size.
     */
    prettifyJson?: boolean;
}

/**
 * Build a safety patch by comparing two declarative ruleset directories.
 * Compares rules by condition, maps to original text rules, and outputs patch.
 *
 * @param params Parameters for patch generation.
 * @param params.oldDir Path to the old ruleset directory.
 * @param params.newDir Path to the new ruleset directory.
 * @param params.outDir Output folder for the patch files.
 * @param params.resourcesPath Path to the resources directory for building $redirect rules.
 * @param params.options Optional options for the build safe patch function.
 */
export async function buildSafePatch(params: BuildSafePatchOptions): Promise<void> {
    const { oldDir, newDir, outDir, resourcesPath, prettifyJson } = params;
    // FIXME: Pass as a parameter.
    const rulesetId = '999';

    const { ruleSet: oldRuleSet, filter: oldFilter } = await loadRuleSetAndFilterFromDir(oldDir, rulesetId);
    const { ruleSet: newRuleSet } = await loadRuleSetAndFilterFromDir(newDir, rulesetId);
    if (!oldRuleSet || !newRuleSet) {
        throw new Error('Could not load both rulesets with all required files.');
    }

    const oldDeclarativeRules = await oldRuleSet.getDeclarativeRules();
    const newDeclarativeRules = await newRuleSet.getDeclarativeRules();

    // IMPORTANT: you must not compare declarative rules by id only!
    // IDs can theoretically collide: if the rule text changes slightly,
    // the new ruleset may have a different rule with the same id.
    const serializeKey = (rule: DeclarativeRule) => JSON.stringify({ rule });

    const newByKey = new Map<string, DeclarativeRule>();
    for (const rule of newDeclarativeRules) {
        newByKey.set(serializeKey(rule), rule);
    }

    const oldByKey = new Map<string, DeclarativeRule>();
    for (const rule of oldDeclarativeRules) {
        oldByKey.set(serializeKey(rule), rule);
    }

    const deletedKeys = [...oldByKey.keys()].filter((k) => !newByKey.has(k));
    const addedKeys = [...newByKey.keys()].filter((k) => !oldByKey.has(k));

    // FIXME: Here comparing will not work since they have different values,
    // but comparing them with id is not correct, since id can be reused for
    // different rules.
    // So we can easily not use changed rules at all, since they just will be
    // added AND deleted in the same time.
    const changedKeys = [...oldByKey.keys()].filter((k) => {
        return newByKey.has(k) && JSON.stringify(oldByKey.get(k)) !== JSON.stringify(newByKey.get(k));
    });

    console.log('Deleted rules:', deletedKeys.length);
    console.log('Added rules:', addedKeys.length);
    console.log('Changed rules:', changedKeys.length);

    const isUnsafe = (rule: DeclarativeRule) => !SAFE_ACTIONS.has(rule.action?.type);
    const disableUnsafeRulesIds = new Set<number>();
    const addUnsafeRules = new Set<string>();
    const addSafeRules = new Set<string>();

    // For all deleted we mark them as disabled unsafe rules.
    for (const key of [...deletedKeys, ...changedKeys]) {
        const oldRule = oldByKey.get(key);
        if (!oldRule) {
            throw new Error('Cannot find old rule for key: ' + key);
        }

        if (!isUnsafe(oldRule)) {
            continue;
        }

        disableUnsafeRulesIds.add(oldRule.id);
    }

    // For added rules we neither add them to the metadata, neither to
    // the ruleset rules.
    for (const key of addedKeys) {
        const newRule = newByKey.get(key);

        if (!newRule) {
            throw new Error('Cannot find new rule for key: ' + key);
        }

        const srcRules = await newRuleSet.getRulesById(newRule.id);
        for (const { sourceRule } of srcRules) {
            if (isUnsafe(newRule)) {
                addUnsafeRules.add(sourceRule);
            } else {
                addSafeRules.add(sourceRule);
            }
        }
    }

    // Add all safe rules to the old filter and convert it
    // again to receive correct counters and source maps.
    const oldContent = await oldFilter.getContent();
    const rawFilterList = oldContent.rawFilterList.concat(
        '\n##### Safety patch ######\n',
        Array.from(addSafeRules).join('\n'),
    );

    await ensureDir(outDir);

    await fs.writeFile(path.join(outDir, `filter_${rulesetId}.txt`), rawFilterList);

    await convertFilters(
        outDir,
        resourcesPath,
        path.join(outDir, '/declarative'),
        { prettifyJson },
    );

    const { ruleSet: rulesetWithSafeRules } = await loadRuleSetAndFilterFromDir(outDir, rulesetId);

    // Then add unsafe rules to the updated ruleset.
    const patch: SafetyPatch = {
        disableUnsafeRulesIds: Array.from(disableUnsafeRulesIds),
        addUnsafeRules: Array.from(addUnsafeRules),
    };

    const rulesetWithSafeAndUnsafeRules = await rulesetWithSafeRules.serializeCompact(
        prettifyJson,
        patch,
    );

    console.log('Disabled unsafe DNR rules ids:', patch.disableUnsafeRulesIds);
    console.log('Added unsafe rules:', patch.addUnsafeRules);

    const ruleSetPath = getRuleSetPath(rulesetId, path.join(outDir, '/declarative'));

    await ensureDir(path.dirname(ruleSetPath));

    await fs.writeFile(ruleSetPath, rulesetWithSafeAndUnsafeRules);

    console.log('Safety update for ruleset saved to:', ruleSetPath);
    // FIXME: Add some tests
}
