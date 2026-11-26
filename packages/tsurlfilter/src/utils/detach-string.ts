/**
 * Returns a copy of the string that does not share memory with the original.
 *
 * The engine keeps the whole text of a filter list in a single string and hands
 * out rule texts as its slices. The runtime may represent such a slice as a
 * window into the parent string, so a short rule text keeps the whole filter
 * list in memory. This function builds a new string from the characters of the
 * argument, so the result can be released independently of the parent string.
 *
 * @param str String to detach.
 *
 * @returns A string equal to the argument that does not share memory with it.
 */
export function detachString(str: string): string {
    return str.split('').join('');
}
