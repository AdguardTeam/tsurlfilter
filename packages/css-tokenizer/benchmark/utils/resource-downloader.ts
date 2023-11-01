/**
 * @file Resource downloader
 */

import fetch from 'node-fetch';

import { type ResourceConfigs, type Resource } from '../common/interfaces';
import { extractAdblockCss } from './extract-adblock-css';

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
 * Helper function to download resources from the web
 *
 * @param resources Resources to download
 * @returns Downloaded resources
 */
export const downloadResources = async (resources: ResourceConfigs): Promise<Resource[]> => {
    const result: Resource[] = [];

    for (const [name, config] of Object.entries(resources)) {
        let content = await fetchFile(config.url);

        if (config.adblock) {
            content = extractAdblockCss(content);
        }

        result.push({
            name,
            content,
        });
    }

    return result;
};
