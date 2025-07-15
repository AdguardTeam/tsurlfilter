import type { PreProcessorCommentRule } from '../../nodes';
import {
    CLOSE_PARENTHESIS,
    COMMA,
    EMPTY,
    OPEN_PARENTHESIS,
    PREPROCESSOR_MARKER,
    SAFARI_CB_AFFINITY,
    SPACE,
} from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { ValueGenerator } from '../misc/value-generator';
import { ParameterListGenerator } from '../misc/parameter-list-generator';
import { LogicalExpressionGenerator } from '../misc/logical-expression-generator';

/**
 * Pre-processor comment generator.
 */
export class PreProcessorCommentGenerator extends BaseGenerator {
    /**
     * Converts a pre-processor comment node to a string.
     *
     * @param node Pre-processor comment node
     * @returns Raw string
     */
    public static generate(node: PreProcessorCommentRule): string {
        let result = EMPTY;

        result += PREPROCESSOR_MARKER;
        result += node.name.value;

        if (node.params) {
            let allowSpaceBetweenParams = true;
            // Space between cb is not allowed for "safari_cb_affinity" directive.
            if (node.name.value === SAFARI_CB_AFFINITY) {
                allowSpaceBetweenParams = false;
            }

            // Space is not allowed after "safari_cb_affinity" directive, so we need to handle it separately.
            if (node.name.value !== SAFARI_CB_AFFINITY) {
                result += SPACE;
            }

            if (node.params.type === 'Value') {
                result += ValueGenerator.generate(node.params);
            } else if (node.params.type === 'ParameterList') {
                result += OPEN_PARENTHESIS;
                result += ParameterListGenerator.generate(node.params, COMMA, allowSpaceBetweenParams);
                result += CLOSE_PARENTHESIS;
            } else {
                result += LogicalExpressionGenerator.generate(node.params);
            }
        }

        return result;
    }
}
