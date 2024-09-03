/**
 * Downloads filter rules from external url.
 *
 * @param url Filter file absolute URL or relative path.
 * @returns A promise that returns string of rules when resolved
 * and error if rejected.
 */
declare const getExternalFile: (url: string) => Promise<string>;
/**
 * Retrieves a local file content asynchronously using XMLHttpRequest or fetch API.
 *
 * @param url The URL of the local file to retrieve.
 * @returns A Promise that resolves to string representing the content of the file.
 * @throws Throws an error if neither XMLHttpRequest nor fetch is available or
 * if getting local files inside a service worker is not supported.
 */
declare const getLocalFile: (url: string) => Promise<string>;
export { getLocalFile, getExternalFile, };
