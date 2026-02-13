/* eslint-disable no-console */
import * as fs from 'fs/promises';
import * as path from 'path';

import { scriptletsCompatibilityTableData } from '../../src/compatibility-tables/compatibility-table-data';
import type { ScriptletDataSchema } from '../../src/compatibility-tables/schemas';

const RESULTS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'results');
const SCRIPTLETS_DIR = path.join(RESULTS_DIR, 'scriptlets');

interface CategoryResults {
    notFoundInTable: string[];
    paramMismatches: string[];
    aliasSyncIssues: string[];
}

interface ExtractedScriptlet {
    name: string;
    parameters?: Array<{ name: string; required?: boolean }>;
    aliases?: string[];
}

/**
 * Gets a scriptlet from the compatibility table by name or alias.
 *
 * @param name - Scriptlet name to search for
 * @returns Scriptlet data or null if not found
 */
function getScriptletFromTable(name: string): ScriptletDataSchema | null {
    const tableKeys = Object.keys(scriptletsCompatibilityTableData.map);

    for (const key of tableKeys) {
        const rowIndex = scriptletsCompatibilityTableData.map[key];
        const row = scriptletsCompatibilityTableData.shared[rowIndex];

        const entryIndices = Object.values(row.map);
        for (const entryIndex of entryIndices) {
            const entry = row.shared[entryIndex];

            if (key === name || entry.aliases?.includes(name)) {
                return entry;
            }
        }
    }

    return null;
}

/**
 * Gets category name from file name.
 *
 * @param fileName - File name
 * @returns Category name
 */
function getCategoryName(fileName: string): string {
    const name = fileName.replace('.json', '');
    const categoryMap: Record<string, string> = {
        abp: 'Adblock Plus',
        adg: 'AdGuard',
        ubo: 'uBlock Origin',
    };
    return categoryMap[name] || name;
}

/**
 * Gets all scriptlet names from the compatibility table.
 *
 * @returns Set of all scriptlet names in the table
 */
function getAllTableScriptletNames(): Set<string> {
    const names = new Set<string>();
    const tableKeys = Object.keys(scriptletsCompatibilityTableData.map);

    for (const key of tableKeys) {
        names.add(key);
    }

    return names;
}

/**
 * Validates extracted scriptlets against compatibility tables.
 */
async function validateScriptlets(): Promise<void> {
    console.log('\n=== Validating Scriptlets ===\n');

    // Check if results directory exists
    try {
        await fs.access(SCRIPTLETS_DIR);
    } catch {
        console.error('❌ Error: Results directory not found. Please run extraction first.');
        console.error(`   Expected directory: ${SCRIPTLETS_DIR}`);
        process.exit(1);
    }

    const files = (await fs.readdir(SCRIPTLETS_DIR)).filter((f) => f.endsWith('.json'));

    if (files.length === 0) {
        console.error('❌ Error: No JSON files found in results directory.');
        process.exit(1);
    }

    console.log(`Found ${files.length} JSON files to validate\n`);

    const resultsByCategory = new Map<string, CategoryResults>();
    const allJsonScriptletNames = new Set<string>();

    // First pass: check extracted JSON files against table
    for (const file of files) {
        const category = getCategoryName(file);
        console.log(`=== Checking ${category} (${file}) ===`);

        const filePath = path.join(SCRIPTLETS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const scriptlets: ExtractedScriptlet[] = JSON.parse(content);

        const categoryResults: CategoryResults = {
            notFoundInTable: [],
            paramMismatches: [],
            aliasSyncIssues: [],
        };

        for (const scriptlet of scriptlets) {
            // Add scriptlet name to the set
            allJsonScriptletNames.add(scriptlet.name);

            // Also add all aliases to the set
            if (scriptlet.aliases && Array.isArray(scriptlet.aliases)) {
                for (const alias of scriptlet.aliases) {
                    allJsonScriptletNames.add(alias);
                }
            }

            // Check all names and collect results
            const allNames = [scriptlet.name, ...(scriptlet.aliases || [])];
            const notFoundNames: string[] = [];
            const tableEntries: Array<{ name: string; entry: ScriptletDataSchema }> = [];

            // Check all names and aliases
            for (const name of allNames) {
                const entry = getScriptletFromTable(name);
                if (!entry) {
                    notFoundNames.push(name);
                } else {
                    tableEntries.push({ name, entry });
                }
            }

            // If no names found at all
            if (tableEntries.length === 0) {
                const actualAliases = notFoundNames.filter((name) => name !== scriptlet.name);
                const message = actualAliases.length > 0
                    ? `"${scriptlet.name}" (and aliases: ${actualAliases.join(', ')})`
                    : `"${scriptlet.name}"`;
                categoryResults.notFoundInTable.push(message);
                continue;
            }

            // If some names found but not all - sync issue
            if (notFoundNames.length > 0) {
                categoryResults.aliasSyncIssues.push(
                    `"${scriptlet.name}": names not in table: ${notFoundNames.join(', ')}`,
                );
            }

            // Check if all found entries have the same parameter count
            const paramCounts = new Set(tableEntries.map((te) => te.entry.parameters?.length || 0));
            if (paramCounts.size > 1) {
                const details = tableEntries.map((te) => `${te.name}:${te.entry.parameters?.length || 0}`);
                categoryResults.aliasSyncIssues.push(
                    `"${scriptlet.name}": inconsistent param counts across names/aliases [${details.join(', ')}]`,
                );
            }

            // Compare with extracted parameter count
            const extractedParamCount = scriptlet.parameters?.length || 0;
            const firstTableParamCount = tableEntries[0].entry.parameters?.length || 0;

            if (extractedParamCount !== firstTableParamCount) {
                categoryResults.paramMismatches.push(
                    `"${scriptlet.name}": extracted ${extractedParamCount}, table ${firstTableParamCount}`,
                );
            }
        }

        resultsByCategory.set(category, categoryResults);

        console.log(`  Total scriptlets: ${scriptlets.length}`);
        console.log(`  Not found in table: ${categoryResults.notFoundInTable.length}`);
        console.log(`  Alias sync issues: ${categoryResults.aliasSyncIssues.length}`);
        console.log(`  Parameter mismatches: ${categoryResults.paramMismatches.length}`);
    }

    // Second pass: find scriptlets in table but not in any extracted JSON
    console.log('\n=== Checking for scriptlets in table but not in extracted JSON files ===');
    const allTableNames = getAllTableScriptletNames();
    const missingFromJson: string[] = [];

    for (const tableName of allTableNames) {
        if (!allJsonScriptletNames.has(tableName)) {
            missingFromJson.push(tableName);
        }
    }

    console.log(`  Found ${missingFromJson.length} scriptlets in table but not in any extracted JSON file`);

    // Print summary by category
    console.log('\n\n=== SUMMARY BY CATEGORY ===\n');

    let totalNotFoundInTable = 0;
    let totalAliasSyncIssues = 0;
    let totalParamMismatches = 0;

    for (const [category, results] of resultsByCategory.entries()) {
        console.log(`\n📦 ${category}:`);

        if (results.notFoundInTable.length > 0) {
            console.log(`  ❌ Scriptlets not found in table (${results.notFoundInTable.length}):`);
            results.notFoundInTable.forEach((name) => console.log(`    - ${name}`));
        }

        if (results.aliasSyncIssues.length > 0) {
            console.log(`  🔄 Alias synchronization issues (${results.aliasSyncIssues.length}):`);
            results.aliasSyncIssues.forEach((msg) => console.log(`    - ${msg}`));
        }

        if (results.paramMismatches.length > 0) {
            console.log(`  ⚠️  Parameter count mismatches (${results.paramMismatches.length}):`);
            results.paramMismatches.forEach((msg) => console.log(`    - ${msg}`));
        }

        const totalIssues = results.notFoundInTable.length
            + results.aliasSyncIssues.length
            + results.paramMismatches.length;

        if (totalIssues === 0) {
            console.log('  ✅ All scriptlets match!');
        }

        totalNotFoundInTable += results.notFoundInTable.length;
        totalAliasSyncIssues += results.aliasSyncIssues.length;
        totalParamMismatches += results.paramMismatches.length;
    }

    // Print scriptlets in table but not in extracted JSON files
    if (missingFromJson.length > 0) {
        console.log('\n\n🔍 Scriptlets in compatibility table but NOT in any extracted JSON file:');
        console.log(`   Total: ${missingFromJson.length}\n`);
        missingFromJson.sort();
        missingFromJson.forEach((name) => console.log(`   - ${name}`));
    }

    console.log('\n\n=== OVERALL SUMMARY ===');
    console.log(`Scriptlets not found in table: ${totalNotFoundInTable}`);
    console.log(`Alias sync issues: ${totalAliasSyncIssues}`);
    console.log(`Parameter mismatches: ${totalParamMismatches}`);
    console.log(`Scriptlets in table but not in extracted JSON: ${missingFromJson.length}`);
    const grandTotal = totalNotFoundInTable + totalAliasSyncIssues + totalParamMismatches + missingFromJson.length;
    console.log(`Total issues: ${grandTotal}`);

    if (grandTotal === 0) {
        console.log('\n🎉 Perfect! All scriptlets and aliases are fully synchronized!');
    } else {
        console.log(`\n❌ Found ${grandTotal} issue(s) that need attention.`);
        process.exit(1);
    }
}

validateScriptlets().catch((error) => {
    console.error('Error during validation:', error);
    process.exit(1);
});
