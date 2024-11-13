import type { ParameterList } from '../../nodes';
import { COMMA, EMPTY, SPACE } from '../../utils/constants';
import { BaseGenerator } from '../base-generator';
import { ValueGenerator } from './value-generator';

/**
 * Generator for parameter list nodes.
 */
export class ParameterListGenerator extends BaseGenerator {
    /**
     * Converts a parameter list AST to a string.
     *
     * @param params Parameter list AST
     * @param separator Separator character (default: comma)
     * @returns String representation of the parameter list
     */
    public static generate(params: ParameterList, separator = COMMA): string {
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

        // join parameters with separator
        // if the separator is a space, join with a single space
        const result = collection.join(separator === SPACE ? separator : `${separator}${SPACE}`);

        return result;
    }
}
