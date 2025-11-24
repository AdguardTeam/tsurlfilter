import { promises as fs } from 'node:fs';

import { Logger } from '@adguard/logger';
import path from 'path';

import { LocalScriptRulesJs } from '../src/common/local-script-rules-js';
import { LocalScriptRulesJson } from '../src/common/local-script-rules-json';

const FILTER_FILE_PREFIX = 'filter_';
const FILTER_FILE_EXTENSION = '.txt';

/**
 * Create a logger instance.
 */
const logger = new Logger();

/**
 * Reads all filter_*.txt files from a directory.
 *
 * @param dir Directory to read from.
 *
 * @returns Array of filter file names.
 */
const getFilterFiles = async (dir: string): Promise<string[]> => {
    const files = await fs.readdir(dir);
    return files.filter((file) => {
        return file.startsWith(FILTER_FILE_PREFIX) && file.endsWith(FILTER_FILE_EXTENSION);
    });
};

/**
 * Creates a JSON file with domain information for Firefox.
 *
 * @param dir Directory containing filter files.
 */
export const createLocalScriptRulesJson = async (dir: string): Promise<void> => {
    const txtFiles = await getFilterFiles(dir);
    const localScriptRulesJson = new LocalScriptRulesJson();
    let allRules = new Map();

    // Collect and merge rules from all filter files
    for (const file of txtFiles) {
        const filterStr = await fs.readFile(path.join(dir, file), 'utf-8');
        const rulesMap = localScriptRulesJson.parse([filterStr]);
        allRules = localScriptRulesJson.extend(allRules, rulesMap);
    }

    // Serialize to JSON string
    const serializedContent = localScriptRulesJson.serialize(allRules);

    // Write to file
    await fs.writeFile(
        path.join(dir, LocalScriptRulesJson.FILENAME),
        serializedContent,
    );

    // Extract real count of serialized rules (without duplicates)
    const deserialized = localScriptRulesJson.deserialize(serializedContent);

    logger.info(`Created ${LocalScriptRulesJson.FILENAME} with ${deserialized.size} unique rules`);
};

/**
 * Reads filters from the directory, extracts JS rules from files starting with filter_ and ending with .txt,
 * and saves them to a JS file in the same directory.
 *
 * Creates a JS file for Chromium MV3 with execution protection.
 *
 * @param dir Directory containing filter files.
 */
export const createLocalScriptRulesJs = async (dir: string): Promise<void> => {
    const files = await getFilterFiles(dir);
    const localScriptRulesJs = new LocalScriptRulesJs();
    const allRules = new Set<string>();

    // Initialize with empty content
    let serializedContent = await localScriptRulesJs.serialize(new Set<string>());

    // Collect and merge rules from all filter files
    for (const file of files) {
        const filterStr = await fs.readFile(path.join(dir, file), 'utf-8');
        const rules = localScriptRulesJs.parse([filterStr]);
        rules.forEach((rule) => allRules.add(rule));
        serializedContent = await LocalScriptRulesJs.extend(serializedContent, [filterStr]);
    }

    // Write to file
    await fs.writeFile(path.join(dir, LocalScriptRulesJs.FILENAME), serializedContent);

    logger.info(`Created ${LocalScriptRulesJs.FILENAME} with ${allRules.size} unique rules`);
};
