/**
 * @file Shared helpers for the standalone, manually-run (HITL) benchmarks in
 * `packages/dnr-converter/benchmarks`. NOT part of the test suite and NOT
 * wired into CI.
 */

import { readFile } from 'node:fs/promises';

/**
 * EasyList filter list URL (used to assemble a 100k+ line representative
 * filter list when no local file is supplied).
 */
export const EASYLIST_URL = 'https://easylist.to/easylist/easylist.txt';

/**
 * EasyPrivacy filter list URL (used together with EasyList to exceed 100k
 * non-empty lines).
 */
export const EASYPRIVACY_URL = 'https://easylist.to/easylist/easyprivacy.txt';

/**
 * Minimum non-empty line count a representative filter list must have for the
 * benchmarks to be considered valid.
 */
export const MIN_LINES = 100_000;

/**
 * Downloads text content from a URL using the built-in global fetch.
 *
 * @param url URL to fetch.
 *
 * @returns Response text.
 *
 * @throws If the request fails or returns a non-OK status.
 */
export const downloadText = async (url: string): Promise<string> => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }
    return res.text();
};

/**
 * Loads filter-list content, either from a local file path or by downloading
 * and concatenating EasyList + EasyPrivacy (>100k lines combined).
 *
 * @param filePath Optional path to a local filter file.
 *
 * @returns Filter-list content as a single string.
 */
export const loadFilterContent = async (filePath?: string): Promise<string> => {
    if (filePath) {
        return readFile(filePath, 'utf-8');
    }

    const [easylist, easyprivacy] = await Promise.all([
        downloadText(EASYLIST_URL),
        downloadText(EASYPRIVACY_URL),
    ]);

    return `${easylist}\n${easyprivacy}`;
};

/**
 * Counts non-empty lines in the given content.
 *
 * @param content Filter-list content.
 *
 * @returns Number of non-empty lines.
 */
export const countLines = (content: string): number => content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .length;
