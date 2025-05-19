/**
 * Fetches a resource from the given URL and returns its content as text.
 *
 * @param url The URL of the resource to fetch.
 *
 * @returns A promise that resolves to the fetched content as a string.
 *
 * @throws If the request fails.
 */
export const fetchExtensionResourceText = async (url: string): Promise<string> => {
    return fetch(url).then((response) => response.text());
};
