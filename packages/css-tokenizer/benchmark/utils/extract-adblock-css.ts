/**
 * @file Get CSS from an Adblock list
 */

import { EMPTY, LINE_FEED } from '../common/constants';

const CSS_RELATED_SEPARATORS = ['##', '#?#', '#@#', '#@?#', '$$', '$@$', '#$#', '#@$#'];
const NEW_LINE_RE = /\r?\n/;
const UBO_JS_MARKER = '+js(';

/**
 * A very simple function that takes the "right side" of the CSS-related filtering rules from an
 * Adblock list and concatenates them into a single string to make it easier to benchmark the
 * performance of the CSS tokenizer.
 *
 * @param content Filter list content
 * @returns CSS parts from the filter list
 * @note Not too accurate, not too fast, but good enough for generate data for the benchmark
 */
export const extractAdblockCss = (content: string) => {
    // Split the content into lines
    const lines = content.split(NEW_LINE_RE);
    let css = EMPTY;

    // Iterate over the lines
    for (const line of lines) {
        for (const separator of CSS_RELATED_SEPARATORS) {
            const index = line.indexOf(separator);

            if (index !== -1) {
                // ignore if separator followed by +js(
                if (line.indexOf(UBO_JS_MARKER, index + separator.length) !== -1) {
                    continue;
                }

                css += line.slice(index + separator.length);
                css += LINE_FEED;
                break;
            }
        }
    }

    return css;
};
