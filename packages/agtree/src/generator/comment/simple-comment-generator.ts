import { BaseGenerator } from '../base-generator.js';
import type { CommentRule } from '../../nodes/index.js';
import { EMPTY } from '../../utils/constants.js';
import { ValueGenerator } from '../misc/value-generator.js';

/**
 * Simple comment generator.
 */
export class SimpleCommentGenerator extends BaseGenerator {
    /**
     * Converts a comment rule node to a string.
     *
     * @param node Comment rule node.
     * @returns Raw string.
     */
    public static generate(node: CommentRule): string {
        let result = EMPTY;

        result += ValueGenerator.generate(node.marker);
        result += ValueGenerator.generate(node.text);

        return result;
    }
}
