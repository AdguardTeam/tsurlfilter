import type { MetadataCommentRule } from '../../nodes';
import { COLON, EMPTY, SPACE } from '../../utils/constants';
import { ValueGenerator } from '../misc/value-generator';
import { BaseGenerator } from '../base-generator';

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
