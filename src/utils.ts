/**
 * Splits the string by the delimiter, ignoring escaped delimiters.
 *
 * @param str string to split
 * @param delimiter delimiter
 * @param escapeCharacter escape character
 * @param preserveAllTokens if true, preserve empty parts
 */
export function splitByDelimiterWithEscapeCharacter(
    str: string,
    delimiter: string,
    escapeCharacter: string,
    preserveAllTokens: boolean,
): string[] {
    const parts: string[] = [];

    if (!str) {
        return parts;
    }

    let sb: string[] = [];
    for (let i = 0; i < str.length; i += 1) {
        const c = str.charAt(i);
        if (c === delimiter) {
            if (i === 0) {
                // Ignore
            } else if (str.charAt(i - 1) === escapeCharacter) {
                sb.splice(sb.length - 1, 1);
                sb.push(c);
            } else {
                if (preserveAllTokens || sb.length > 0) {
                    const part = sb.join('');
                    parts.push(part);
                    sb = [];
                }
            }
        } else {
            sb.push(c);
        }
    }

    if (preserveAllTokens || sb.length > 0) {
        parts.push(sb.join(''));
    }

    return parts;
}
