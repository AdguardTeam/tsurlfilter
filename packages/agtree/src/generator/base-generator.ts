/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @file Base generator class.
 */
import { NotImplementedError } from '../errors/not-implemented-error.js';
import { type Node } from '../nodes/index.js';

/**
 * Base class for generators. Each generator should extend this class.
 */
export class BaseGenerator {
    /**
     * Generates a string from the AST node.
     *
     * @param node AST node to generate a string from.
     */
    public static generate(node: Node): string {
        throw new NotImplementedError();
    }
}
