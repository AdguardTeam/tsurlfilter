/**
 * @file Helper function to fetch a file contents from a URL.
 */
import fetch from 'node-fetch';

/**
 * Helper function to fetch a file contents from a URL.
 *
 * @param url File URL to fetch.
 *
 * @returns File contents.
 *
 * @throws If the file could not be fetched.
 */
export const fetchFile = async (url: string) => {
    const response = await fetch(url);
    const text = await response.text();
    return text;
};
