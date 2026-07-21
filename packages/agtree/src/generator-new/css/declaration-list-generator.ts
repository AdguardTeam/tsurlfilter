/**
 * @file CSS declaration list generator.
 *
 * Serializes a {@link CssDeclarationList} AST node into its string
 * representation, joining each {@link CssDeclaration} with `; ` separators
 * and appending `!important` where applicable.
 */

import { type CssDeclarationList } from '../../nodes-new';
import {
    COLON,
    CSS_IMPORTANT,
    EMPTY,
    SEMICOLON,
    SPACE,
} from '../../utils/constants';
import { BaseGenerator } from '../base-generator';

/**
 * CSS declaration list generator.
 */
export class DeclarationListGenerator extends BaseGenerator {
    /**
     * Generates a string representation of the CSS declaration list.
     *
     * @param node CSS declaration list node.
     *
     * @returns String representation of the declaration list.
     *
     * @throws Error if the `node` is invalid.
     */
    public static generate(node: CssDeclarationList): string {
        const result: string[] = [];

        for (let i = 0; i < node.children.length; i += 1) {
            const decl = node.children[i];

            if (i > 0) {
                result.push(SEMICOLON);
                result.push(SPACE);
            }

            result.push(decl.property.value);
            result.push(COLON);
            result.push(SPACE);
            result.push(decl.value.value);

            if (decl.important) {
                result.push(SPACE);
                result.push(CSS_IMPORTANT);
            }
        }

        return result.join(EMPTY);
    }
}
