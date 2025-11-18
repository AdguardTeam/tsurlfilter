import { promises as fs } from 'fs';
import { copy } from 'fs-extra';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import { startDownload } from '../../../common/filters-downloader';
import { serializedAndValidate } from '../../../tasks/local-scripts';
import {
    extractJsRules,
    formatRules,
    LOCAL_SCRIPT_RULES_JS_FILENAME,
    LOCAL_SCRIPT_RULES_JSON_FILENAME,
} from '../../common/local-script-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Re-export constants
export { LOCAL_SCRIPT_RULES_JS_FILENAME, LOCAL_SCRIPT_RULES_JSON_FILENAME };

export type AssetsLoaderOptions = {
    /**
     * Whether to download latest text filters instead of DNR rulesets.
     */
    latestFilters?: boolean;
};

/**
 * Api for loading assets.
 *
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
     * Extends the local script rules file with custom rules.
     * Parses the custom rules, extracts JS rules from them, and appends them
     * to the existing local_script_rules.js file.
     *
     * @param localScriptRulesPath Path to the local_script_rules.js file to extend.
     * @param customRules Array of custom rule strings to add.
     *
     * @returns Promise that resolves when the file is updated.
     */
    public async extendLocalScriptRules(
        localScriptRulesPath: string,
        customRules: string[],
    ): Promise<void> {
        const filePath = path.resolve(process.cwd(), localScriptRulesPath);

        // Parse custom rules to extract JS rules
        const filterStr = customRules.join('\n');
        const customJsRules = extractJsRules(filterStr);

        if (customJsRules.size === 0) {
            console.log('No valid JS rules found in custom rules');
            return;
        }

        // Format the new rules to append
        const formattedNewRules = formatRules(customJsRules);

        // Extract existing rules
        const { localScriptRules } = await import(filePath);

        console.log(`Extracted ${Object.keys(localScriptRules).length} existing local script rules`);

        // Convert existing rules to formatted strings
        const existingFormattedRules = Object.entries(localScriptRules).map(([key, func]) => {
            // Use JSON.stringify to properly escape the key
            const escapedKey = JSON.stringify(key);
            const funcStr = (func as (() => void)).toString();
            return `${escapedKey}: ${funcStr},`;
        });

        const updatedContent = await serializedAndValidate([
            ...existingFormattedRules,
            ...formattedNewRules,
        ]);

        await fs.writeFile(filePath, updatedContent);

        console.log(`Extended ${localScriptRulesPath} with ${customJsRules.size} custom rules`);
    }
}
