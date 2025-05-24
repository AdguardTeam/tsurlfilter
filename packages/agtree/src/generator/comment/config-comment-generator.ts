import { BaseGenerator } from '../base-generator.js';
import type { ConfigCommentRule } from '../../nodes/index.js';
import { COMMA, EMPTY, SPACE } from '../../utils/constants.js';
import { ParameterListGenerator } from '../misc/parameter-list-generator.js';

/**
 * Converts inline configuration comment nodes to their string format.
 */
export class ConfigCommentGenerator extends BaseGenerator {
    /**
     * Converts an inline configuration comment node to a string.
     *
     * @param node Inline configuration comment node
     * @returns Raw string
     */
    public static generate(node: ConfigCommentRule): string {
        let result = EMPTY;

        result += node.marker.value;
        result += SPACE;
        result += node.command.value;

        if (node.params) {
            result += SPACE;

            if (node.params.type === 'ParameterList') {
                result += ParameterListGenerator.generate(node.params, COMMA);
            } else {
                // Trim JSON boundaries
                result += JSON.stringify(node.params.value).slice(1, -1).trim();
            }
        }

        // Add comment within the config comment
        if (node.comment) {
            result += SPACE;
            result += node.comment.value;
        }

        return result;
    }
}
