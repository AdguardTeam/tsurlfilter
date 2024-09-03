import { AnySelectorNodeInterface } from '../nodes';
export declare const IS_OR_NOT_PSEUDO_SELECTING_ROOT: string;
/**
 * Optimizes ast:
 * If arg of :not() and :is() pseudo-classes does not contain extended selectors,
 * native Document.querySelectorAll() can be used to query elements.
 * It means that ExtendedSelector ast nodes can be removed
 * and value of relevant RegularSelector node should be updated accordingly.
 *
 * @param ast Non-optimized ast.
 *
 * @returns Optimized ast.
 */
export declare const optimizeAst: (ast: AnySelectorNodeInterface) => AnySelectorNodeInterface;
