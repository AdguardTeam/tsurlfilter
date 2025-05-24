import { BaseGenerator } from '../base-generator.js';
import type { ModifierList } from '../../nodes/index.js';
import { MODIFIERS_SEPARATOR } from '../../utils/constants.js';
import { ModifierGenerator } from './modifier-generator.js';

/**
 * Generator for modifier list nodes.
 */
export class ModifierListGenerator extends BaseGenerator {
    /**
     * Converts a modifier list AST to a string.
     *
     * @param ast Modifier list AST
     * @returns Raw string
     */
    public static generate(ast: ModifierList): string {
        const result = ast.children
            .map(ModifierGenerator.generate)
            .join(MODIFIERS_SEPARATOR);

        return result;
    }
}
