import { BaseGenerator } from '../base-generator';
import type { CommentRule } from '../../nodes';
import { EMPTY } from '../../utils/constants';
import { ValueGenerator } from '../misc/value-generator';

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
