import { BaseGenerator } from '../base-generator';
import type { ModifierList } from '../../nodes';
import { MODIFIERS_SEPARATOR } from '../../utils/constants';
import { ModifierGenerator } from './modifier-generator';

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
