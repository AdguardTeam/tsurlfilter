import type { MetadataCommentRule } from '../../nodes/index.js';
import { COLON, EMPTY, SPACE } from '../../utils/constants.js';
import { ValueGenerator } from '../misc/value-generator.js';
import { BaseGenerator } from '../base-generator.js';

/**
 * Metadata comment generator.
 */
export class MetadataCommentGenerator extends BaseGenerator {
    /**
     * Converts a metadata comment rule node to a string.
     *
     * @param node Metadata comment rule node.
     * @returns Raw string.
     */
    public static generate(node: MetadataCommentRule): string {
        let result = EMPTY;

        result += ValueGenerator.generate(node.marker);
        result += SPACE;
        result += ValueGenerator.generate(node.header);
        result += COLON;
        result += SPACE;
        result += ValueGenerator.generate(node.value);

        return result;
    }
}
