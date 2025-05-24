import { BaseGenerator } from '../base-generator.js';
import type { HintCommentRule } from '../../nodes/index.js';
import { HINT_MARKER, SPACE } from '../../utils/constants.js';
import { HintGenerator } from './hint-generator.js';

/**
 * Hint comment generator.
 */
export class HintCommentGenerator extends BaseGenerator {
    /**
     * Converts a hint rule node to a raw string.
     *
     * @param node Hint rule node
     * @returns Raw string
     */
    public static generate(node: HintCommentRule): string {
        let result = HINT_MARKER + SPACE;

        result += node.children.map(HintGenerator.generate).join(SPACE);

        return result;
    }
}
