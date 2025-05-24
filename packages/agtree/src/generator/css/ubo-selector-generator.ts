import { BaseGenerator } from '../base-generator.js';
import { UboPseudoName } from '../../common/ubo-selector-common.js';
import {
    CLOSE_PARENTHESIS,
    COLON,
    CSS_NOT_PSEUDO,
    EMPTY,
    OPEN_PARENTHESIS,
    SPACE,
} from '../../utils/constants';
import { type UboSelector } from '../../nodes/index.js';

/**
 * UBO selector generator.
 */
export class UboSelectorGenerator extends BaseGenerator {
    /**
     * Serializes a uBO selector node to a string.
     *
     * @param node UBO selector node
     * @returns Raw string
     */
    public static generate(node: UboSelector): string {
        const prefix: string[] = []; // List of leading modifiers
        const suffix: string[] = []; // List of trailing modifiers, typically style injection

        if (node.modifiers) {
            for (const modifier of node.modifiers.children) {
                switch (modifier.name.value) {
                    case UboPseudoName.Remove:
                    case UboPseudoName.Style:
                        // eslint-disable-next-line max-len
                        suffix.push(COLON, modifier.name.value, OPEN_PARENTHESIS, modifier.value?.value || EMPTY, CLOSE_PARENTHESIS);
                        break;

                    default:
                        // Wrap exceptions in `:not()`
                        if (modifier.exception) {
                            prefix.push(COLON, CSS_NOT_PSEUDO, OPEN_PARENTHESIS);
                        }

                        // :modifier-name(value)
                        // eslint-disable-next-line max-len
                        prefix.push(COLON, modifier.name.value, OPEN_PARENTHESIS, modifier.value?.value || EMPTY, CLOSE_PARENTHESIS);

                        // Close the `:not()` if we are in an exception
                        if (modifier.exception) {
                            prefix.push(CLOSE_PARENTHESIS);
                        }

                        break;
                }
            }
        }

        // Prepare the result
        let result = EMPTY;

        if (prefix.length > 0) {
            result += prefix.join(EMPTY);

            // Add a space between the selector and the leading modifier(s)
            if (node.selector?.value) {
                result += SPACE;
            }
        }

        result += node.selector?.value || EMPTY;
        result += suffix.join(EMPTY);

        return result;
    }
}
