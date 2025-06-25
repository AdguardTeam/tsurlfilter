/* eslint-disable max-len */
import { serializeJson } from '@adguard/tsurlfilter';
import { DeclarativeRule } from '@adguard/tsurlfilter/es/declarative-converter';
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
     * Defines whether to prettify the rulesets JSON or not.
     * Not prettifying can save on JSON size.
     * Default value specified here {@link CONVERT_FILTER_DEFAULT_OPTIONS.prettifyJson}.
     */
    prettifyJson?: boolean;
}

/**
 * Patch for unsafe rules: disables unsafe rule IDs and adds unsafe text rules.
 */
export interface SafetyPatch {
    disableUnsafeRulesIds: number[];
    addUnsafeRules: string[];
    addDnrRules: Set<DeclarativeRule>;
    excludeDnrRules: Set<DeclarativeRule>;
}

/**
 *
 * @param dir
 * @param id
 * @param safetyPatch
 * @param prettifyJson
 */
async function postProcessRuleset(
    dir: string,
    id: string,
    outDir: string,
    safetyPatch: SafetyPatch,
    prettifyJson: boolean = false,
) {
    const {
        disableUnsafeRulesIds,
        addUnsafeRules,
        addDnrRules,
        excludeDnrRules,
    } = safetyPatch;

    const rulesetPath = path.join(dir, `declarative/ruleset_${id}/ruleset_${id}.json`);

    const rulesetRaw = await fs.readFile(rulesetPath, 'utf8');

    let parsedRuleSet = JSON.parse(rulesetRaw);

    Object.assign(parsedRuleSet[0].metadata.metadata, {
        disableUnsafeRulesIds,
        addUnsafeRules,
    });

    const excludeDnrRulesIds = new Set<number>(Array.from(excludeDnrRules).map((rule) => rule.id));
    console.log('Excluding DNR rules with ids:', Array.from(excludeDnrRulesIds));

    parsedRuleSet = parsedRuleSet.filter((rule: DeclarativeRule) => !excludeDnrRulesIds.has(rule.id));

    console.log('Adding DNR rules:', Array.from(addDnrRules).map((rule) => rule.id));

    parsedRuleSet = parsedRuleSet.concat(Array.from(addDnrRules));

    const patchedRuleSetPath = getRuleSetPath(id, outDir);

    await fs.writeFile(patchedRuleSetPath, serializeJson(parsedRuleSet, prettifyJson));
}

/**
 * Build a safety patch by comparing two declarative ruleset directories.
 * Compares rules by condition, maps to original text rules, and outputs patch.
 *
 * @param params Parameters for patch generation.
 * @param params.oldDir Path to the old ruleset directory.
 * @param params.newDir Path to the new ruleset directory.
 * @param params.outDir Output folder for the patch files.
 * @param params.options Optional options for the build safe patch function.
 */
export async function buildSafePatch(params: BuildSafePatchOptions): Promise<void> {
    const { oldDir, newDir, outDir, prettifyJson } = params;
    const rulesetId = '999';

    const { ruleSet: oldRuleSet, filter: oldFilter } = await loadRuleSetAndFilterFromDir(oldDir, rulesetId);
    const { ruleSet: newRuleSet } = await loadRuleSetAndFilterFromDir(newDir, rulesetId);
    if (!oldRuleSet || !newRuleSet) {
        throw new Error('Could not load both rulesets with all required files.');
    }

    const oldDeclarativeRules = await oldRuleSet.getDeclarativeRules();
    const newDeclarativeRules = await newRuleSet.getDeclarativeRules();

    // ВАЖНО: нельзя сравнивать декларативные правила только по id!
    // ID в теории может дать коллизию, если текст правила изменился не значительно,
    // то в новом рулсете будет уже другое правило, но с таким же id.
    const serializeKey = (rule: DeclarativeRule) => JSON.stringify({ rule });

    const newByKey = new Map<string, DeclarativeRule>();
    // const newRulesetDnrIds = new Set<number>();
    for (const rule of newDeclarativeRules) {
        newByKey.set(serializeKey(rule), rule);
        // newRulesetDnrIds.add(rule.id);
    }

    const oldByKey = new Map<string, DeclarativeRule>();
    for (const rule of oldDeclarativeRules) {
        // while (newRulesetDnrIds.has(rule.id)) {
        //     rule.id++;

        //     if (rule.id > DeclarativeRulesConverter.MAX_DECLARATIVE_RULE_ID) {
        //         rule.id = DeclarativeRulesConverter.MIN_DECLARATIVE_RULE_ID;
        //     }
        // }
        oldByKey.set(serializeKey(rule), rule);
    }

    // Ключи, которые есть в старом, но нет в новом — удалённые правила
    const deletedKeys = [...oldByKey.keys()].filter((k) => !newByKey.has(k));
    // Ключи, которые есть в новом, но нет в старом — добавленные правила
    const addedKeys = [...newByKey.keys()].filter((k) => !oldByKey.has(k));
    // Ключи, которые есть и там, и там, но содержимое отличается — изменённые правила
    const changedKeys = [...oldByKey.keys()].filter(
        (k) => newByKey.has(k) && JSON.stringify(oldByKey.get(k)) !== JSON.stringify(newByKey.get(k)),
    );

    // Собираем unsafe-правила (например, action.type === 'redirect')
    const isUnsafe = (rule: DeclarativeRule) => !SAFE_ACTIONS.has(rule.action?.type);
    const disableUnsafeRulesIds = new Set<number>();
    const addUnsafeRules = new Set<string>();
    const addDnrRules = new Set<DeclarativeRule>();
    const excludeDnrRules = new Set<DeclarativeRule>();

    // const oldRulesetFilterContent = await oldFilter.getContent();
    // const oldRulesetFilterRules = new Set(oldRulesetFilterContent.rawFilterList.split('\n'));

    // console.log('Old ruleset filter rules:', Array.from(oldRulesetFilterRules));

    // Для удалённых и изменённых декларативных правил:
    for (const key of [...deletedKeys, ...changedKeys]) {
        const oldRule = oldByKey.get(key);
        if (!oldRule) {
            throw new Error('Cannot find old rule for key: ' + key);
        }

        if (!isUnsafe(oldRule)) {
            continue;
        }

        disableUnsafeRulesIds.add(oldRule.id);
        addDnrRules.add(oldRule);

        // // Получаем все исходные текстовые правила через getRulesById
        // const srcRules = await oldRuleSet.getRulesById(oldRule.id);
        // for (const { sourceRule } of srcRules) {
        //     if (newRulesetFilterRules.has(sourceRule)) {
        //         addUnsafeRules.add(sourceRule);
        //     }
        // }
    }

    // Для добавленных декларативных правил:
    for (const key of addedKeys) {
        const newRule = newByKey.get(key);

        if (!newRule) {
            throw new Error('Cannot find new rule for key: ' + key);
        }

        if (!isUnsafe(newRule)) {
            continue;
        }

        excludeDnrRules.add(newRule);

        const srcRules = await newRuleSet.getRulesById(newRule.id);
        for (const { sourceRule } of srcRules) {
            addUnsafeRules.add(sourceRule);
        }
    }

    // --- Финальный результат ---
    const patch: SafetyPatch = {
        disableUnsafeRulesIds: Array.from(disableUnsafeRulesIds),
        addUnsafeRules: Array.from(addUnsafeRules),
        addDnrRules,
        excludeDnrRules,
    };

    const result = await newRuleSet.serializeCompact(prettifyJson);
    const ruleSetPath = getRuleSetPath(rulesetId, outDir);

    await ensureDir(path.dirname(ruleSetPath));

    await fs.writeFile(ruleSetPath, result);

    await postProcessRuleset(newDir, rulesetId, outDir, patch, prettifyJson);

    // // FIXME: Write this to new ruleset metadata
    // await fs.writeFile(path.join(outDir, 'safety_patch.json'), JSON.stringify(patch, null, 2), 'utf-8');
    // console.log(`Safety patch written to ${outDir}/safety_patch.json`);

    // // FIXME: Insert this to new ruleset metadata
    // await fs.writeFile(path.join(outDir, 'dnr_rules_to_return.json'), JSON.stringify(Array.from(dnrRulesToReturnInNewRuleset), null, 2), 'utf-8');
    // console.log(`DNR rules to return written to ${outDir}/dnr_rules_to_return.json`);

    // FIXME: Add some tests
}
