import type { CommentRule } from '../../nodes';
import { EMPTY, SPACE } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { ValueGenerator } from '../misc/value-generator';

/**
 * Simple comment generator.
 */
export class SimpleCommentGenerator extends BaseGenerator {
    /**
     * Converts a comment rule node to a string.
     *
     * @param node Comment rule node.
     *
     * @returns Raw string.
     */
    public static generate(node: CommentRule): string {
        let result = EMPTY;

        result += ValueGenerator.generate(node.marker);

        const text = ValueGenerator.generate(node.text);

        // Preserve the original marker-to-text spacing when it was captured;
        // otherwise fall back to a single space, but only when there is text to
        // separate (avoids a trailing space for marker-only comments like `!`).
        if (node.markerSpacing !== undefined) {
            result += node.markerSpacing;
        } else if (text.length > 0) {
            result += SPACE;
        }

        result += text;

        return result;
    }
}
