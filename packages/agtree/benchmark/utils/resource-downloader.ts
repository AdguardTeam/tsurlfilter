/**
 * @file Resource downloader
 */

import fetch from 'node-fetch';

import { type ResourceConfigs, type Resource } from '../common/interfaces';
import { EXCLAMATION_MARK, LINE_FEED, RE_NL_SPLIT } from '../common/constants';

/**
 * Helper function to fetch a file contents from a URL
 *
 * @param url File URL to fetch
 * @returns File contents
 * @throws If the file could not be fetched
 */
const fetchFile = async (url: string) => {
    const response = await fetch(url);
    const text = await response.text();
    return text;
};

/**
 * Apply a filter to the resource content
 *
 * @param content File contents
 * @returns Filtered file contents
 * @note This function transforms the file contents, so reported locations may be incorrect, if you check them against
 * the original file.
 */
const filterResourceContent = (content: string) => {
    return content.split(RE_NL_SPLIT).filter(
        // Remove comments
        (line) => line.trim()[0] !== EXCLAMATION_MARK,
        // TODO: Add more filters, if needed
    ).join(LINE_FEED);
};

/**
 * Helper function to download resources from the web
 *
 * @param resources Resources to download
 * @returns Downloaded resources
 */
export const downloadResources = async (resources: ResourceConfigs): Promise<Resource[]> => {
    const result: Resource[] = [];

    for (const [name, config] of Object.entries(resources)) {
        result.push({
            name,
            content: filterResourceContent(await fetchFile(config.url)),
        });
    }

    return result;
};
