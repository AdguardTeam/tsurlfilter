import type { AgentCommentRule } from '../../nodes/index.js';
import {
    CLOSE_SQUARE_BRACKET,
    OPEN_SQUARE_BRACKET,
    SEMICOLON,
    SPACE,
} from '../../utils/constants';
import { BaseGenerator } from '../base-generator.js';
import { AgentGenerator } from './agent-generator.js';

/**
 * Generator for agent comment rules.
 */
export class AgentCommentGenerator extends BaseGenerator {
    /**
     * Converts an adblock agent AST to a string.
     *
     * @param ast Agent rule AST
     * @returns Raw string
     */
    public static generate(ast: AgentCommentRule): string {
        let result = OPEN_SQUARE_BRACKET;

        result += ast.children
            .map(AgentGenerator.generate)
            .join(SEMICOLON + SPACE);

        result += CLOSE_SQUARE_BRACKET;

        return result;
    }
}
