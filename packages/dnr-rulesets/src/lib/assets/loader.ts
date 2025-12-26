import { promises as fs } from 'fs';
import { copy } from 'fs-extra';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import { startDownload } from '../../../common/filters-downloader';
import { LocalScriptRulesJs } from '../../common/local-script-rules-js';
import { LocalScriptRulesJson } from '../../common/local-script-rules-json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Re-export constants
export const LOCAL_SCRIPT_RULES_JS_FILENAME = LocalScriptRulesJs.FILENAME;
export const LOCAL_SCRIPT_RULES_JSON_FILENAME = LocalScriptRulesJson.FILENAME;

export type AssetsLoaderOptions = {
    /**
     * Whether to download latest text filters instead of DNR rulesets.
     */
    latestFilters?: boolean;
};

/**
 * Api for loading assets.
 */
export class AssetsLoader {
    /**
     * Download rulesets or filters to {@link dest} path. If {@link options.rawFilters}
     * is set to `true`, it will only download raw filters from the server,
     * otherwise it will copy rulesets from the local directory.
     *
     * @param dest Path to download assets.
     * @param options Options for loading assets.
     *
     * @returns Promise that resolves when assets are downloaded.
     */
    public async load(dest: string, options?: AssetsLoaderOptions): Promise<void> {
        const to = path.resolve(process.cwd(), dest);

        if (options?.latestFilters) {
            await startDownload(to);
            return;
        }

        const src = path.resolve(__dirname, '../filters');

        console.log(`Copying rulesets and local script rules from ${src} to ${to}`);

        await copy(src, to);

        console.log(`Copying rulesets and local script rules from ${src} to ${to} done.`);
    }

    /**
     * Copy only the local script rules JS file to the destination path.
     *
     * @param dest Path to copy the local script rules JS file to.
     *
     * @returns Promise that resolves when the file is copied.
     */
    public async copyLocalScriptRulesJs(dest: string): Promise<void> {
        const to = path.resolve(process.cwd(), dest);
        const src = path.resolve(__dirname, '../filters', LOCAL_SCRIPT_RULES_JS_FILENAME);

        console.log(`Copying local script rules JS from ${src} to ${to}`);

        await copy(src, to);

        console.log(`Copying local script rules JS from ${src} to ${to} done.`);
    }

    /**
     * Copy only the local script rules JSON file to the destination path.
     *
     * @param dest Path to copy the local script rules JSON file to.
     *
     * @returns Promise that resolves when the file is copied.
     */
    public async copyLocalScriptRulesJson(dest: string): Promise<void> {
        const to = path.resolve(process.cwd(), dest);
        const src = path.resolve(__dirname, '../filters', LOCAL_SCRIPT_RULES_JSON_FILENAME);

        console.log(`Copying local script rules JSON from ${src} to ${to}`);

        await copy(src, to);

        console.log(`Copying local script rules JSON from ${src} to ${to} done.`);
    }

    /**
     * Extends the local script rules file with custom rules.
     * Parses the custom rules, extracts JS rules from them, and appends them
     * to the existing local_script_rules.js file.
     *
     * Uses a placeholder-based approach to insert new rules without AST deserialization,
     * which is much faster than previous approaches.
     *
     * @param localScriptRulesPath Path to the local_script_rules.js file to extend.
     * @param customRules Array of custom rule strings to add.
     *
     * @returns Promise that resolves when the file is updated.
     */
    public async extendLocalScriptRulesJs(
        localScriptRulesPath: string,
        customRules: string[],
    ): Promise<void> {
        const filePath = path.resolve(process.cwd(), localScriptRulesPath);

        // Read existing content
        const existingContent = await fs.readFile(filePath, 'utf-8');

        // Extend using static method - it handles parsing and insertion
        const updatedContent = await LocalScriptRulesJs.extend(existingContent, customRules);

        // Write back updated content
        await fs.writeFile(filePath, updatedContent);

        console.log(`Custom rules added to ${localScriptRulesPath}: ${customRules.length}`);
    }

    /**
     * Extends the local script rules JSON file with custom rules.
     * Parses the custom rules, extracts JS rules with domain configurations,
     * and merges them into the existing local_script_rules.json file.
     *
     * @param localScriptRulesJsonPath Path to the local_script_rules.json file to extend.
     * @param customRules Array of custom rule strings to add.
     *
     * @returns Promise that resolves when the file is updated.
     */
    public async extendLocalScriptRulesJson(
        localScriptRulesJsonPath: string,
        customRules: string[],
    ): Promise<void> {
        const filePath = path.resolve(process.cwd(), localScriptRulesJsonPath);

        // Parse custom rules to extract JS rules with domains
        const newRules = LocalScriptRulesJson.parse(customRules);

        if (newRules.size === 0) {
            console.log('No valid JS rules found in custom rules');
            return;
        }

        // Read and deserialize existing rules
        const existingContent = await fs.readFile(filePath, 'utf-8');
        const existingRules = LocalScriptRulesJson.deserialize(existingContent);

        console.log(`Extracted ${existingRules.size} existing local script rules`);

        // Extend existing rules with new rules
        const mergedRules = LocalScriptRulesJson.extend(existingRules, newRules);

        // Serialize and write back
        const updatedContent = LocalScriptRulesJson.serialize(mergedRules);
        await fs.writeFile(filePath, updatedContent);

        console.log(`Extended ${localScriptRulesJsonPath} with ${newRules.size} custom rules`);
    }
}
