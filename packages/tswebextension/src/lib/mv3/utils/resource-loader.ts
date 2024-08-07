/**
 * Loads a resource from the extension resources.
 *
 * @param path Path to the resource.
 * @returns Promise resolved with the resource.
 *
 * @throws If the resource is not found.
 */
const loadExtensionResource = async (path: string): Promise<Response> => {
    const chromeUrl = chrome.runtime.getURL(path);
    return fetch(chromeUrl);
};

/**
 * Loads a text file from the extension resources.
 *
 * @param path Path to the file.
 * @returns Promise resolved with file content as a string.
 */
export const loadExtensionTextResource = async (path: string): Promise<string> => {
    const file = await loadExtensionResource(path);
    return file.text();
};

/**
 * Loads a binary file from the extension resources.
 *
 * @param path Path to the file.
 * @returns Promise resolved with file content as an ArrayBuffer.
 */
export const loadExtensionBinaryResource = async (path: string): Promise<ArrayBuffer> => {
    const file = await loadExtensionResource(path);
    return file.arrayBuffer();
};
