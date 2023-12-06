/**
 * Handles HTML entities.
 * This is a workaround for the following issue:
 * https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2249
 * website was broken because win-1251 charset doesn't support some entities, e.g., ❤,
 * which initially in the html string was &#10084 and after parsing became ❤.
 */
export class EntityHandler {
    /**
     * Escapes specific entities in an HTML string.
     * @param html String to escape.
     * @returns Escaped string.
     */
    static escapeEntities(html: string): string {
        return html.replace(/&#x([A-Fa-f0-9]{4});/g, '&amp;#x$1;');
    }

    /**
     * Reverts escaped entities back to their original form.
     * @param html String to revert.
     * @returns Reverted string.
     */
    static revertEntities(html: string): string {
        return html.replace(/&amp;#x([A-Fa-f0-9]{4});/g, '&#x$1;');
    }
}
