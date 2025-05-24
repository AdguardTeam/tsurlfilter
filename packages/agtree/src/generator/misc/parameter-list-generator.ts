import type { ParameterList } from '../../nodes/index.js';
import { COMMA, EMPTY, SPACE } from '../../utils/constants.js';
import { BaseGenerator } from '../base-generator.js';
import { ValueGenerator } from './value-generator.js';

/**
 * Generator for parameter list nodes.
 */
export class ParameterListGenerator extends BaseGenerator {
    /**
     * Converts a parameter list AST to a string.
     *
     * @param params Parameter list AST
     * @param separator Separator character (default: comma)
     * @param allowSpace Allow space between parameters (default: true)
     * @returns String representation of the parameter list
     */
    public static generate(params: ParameterList, separator = COMMA, allowSpace = true): string {
        const collection: string[] = [];

        let i = 0;
        for (; i < params.children.length; i += 1) {
            const param = params.children[i];
            if (param === null) {
                collection.push(EMPTY);
            } else {
                collection.push(ValueGenerator.generate(param));
            }
        }

        let result = EMPTY;

        // if allowSpace is true, join with a single separator
        // without space
        if (!allowSpace && separator !== SPACE) {
            result = collection.join(separator);
        } else {
            // join parameters with separator
            // if the separator is a space, join with a single space
            result = collection.join(separator === SPACE ? separator : `${separator}${SPACE}`);
        }

        return result;
    }
}
