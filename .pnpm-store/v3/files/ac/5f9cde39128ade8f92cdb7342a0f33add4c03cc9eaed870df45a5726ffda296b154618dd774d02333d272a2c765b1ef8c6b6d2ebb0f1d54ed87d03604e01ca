import { AnySelectorNodeInterface } from '../nodes';
/**
 * Checks whether the type of `astNode` is SelectorList.
 *
 * @param astNode Ast node.
 *
 * @returns True if astNode.type === SelectorList.
 */
export declare const isSelectorListNode: (astNode: AnySelectorNodeInterface | null) => boolean;
/**
 * Checks whether the type of `astNode` is Selector.
 *
 * @param astNode Ast node.
 *
 * @returns True if astNode.type === Selector.
 */
export declare const isSelectorNode: (astNode: AnySelectorNodeInterface | null) => boolean;
/**
 * Checks whether the type of `astNode` is RegularSelector.
 *
 * @param astNode Ast node.
 *
 * @returns True if astNode.type === RegularSelector.
 */
export declare const isRegularSelectorNode: (astNode: AnySelectorNodeInterface | null) => boolean;
/**
 * Checks whether the type of `astNode` is ExtendedSelector.
 *
 * @param astNode Ast node.
 *
 * @returns True if astNode.type === ExtendedSelector.
 */
export declare const isExtendedSelectorNode: (astNode: AnySelectorNodeInterface) => boolean;
/**
 * Checks whether the type of `astNode` is AbsolutePseudoClass.
 *
 * @param astNode Ast node.
 *
 * @returns True if astNode.type === AbsolutePseudoClass.
 */
export declare const isAbsolutePseudoClassNode: (astNode: AnySelectorNodeInterface | null) => boolean;
/**
 * Checks whether the type of `astNode` is RelativePseudoClass.
 *
 * @param astNode Ast node.
 *
 * @returns True if astNode.type === RelativePseudoClass.
 */
export declare const isRelativePseudoClassNode: (astNode: AnySelectorNodeInterface | null) => boolean;
/**
 * Returns name of `astNode`.
 *
 * @param astNode AbsolutePseudoClass or RelativePseudoClass node.
 *
 * @returns Name of `astNode`.
 * @throws An error on unsupported ast node or no name found.
 */
export declare const getNodeName: (astNode: AnySelectorNodeInterface | null) => string;
/**
 * Returns value of `astNode`.
 *
 * @param astNode RegularSelector or AbsolutePseudoClass node.
 * @param errorMessage Optional error message if no value found.
 *
 * @returns Value of `astNode`.
 * @throws An error on unsupported ast node or no value found.
 */
export declare const getNodeValue: (astNode: AnySelectorNodeInterface | null, errorMessage?: string) => string;
/**
 * Returns the first RegularSelector node from `children`.
 *
 * @param children Array of ast node children.
 * @param errorMessage Optional error message if no value found.
 *
 * @returns Ast RegularSelector node.
 * @throws An error if no RegularSelector node found.
 */
export declare const getFirstRegularChild: (children: AnySelectorNodeInterface[], errorMessage?: string) => AnySelectorNodeInterface;
/**
 * Returns the last RegularSelector node from `children`.
 *
 * @param children Array of ast node children.
 *
 * @returns Ast RegularSelector node.
 * @throws An error if no RegularSelector node found.
 */
export declare const getLastRegularChild: (children: AnySelectorNodeInterface[]) => AnySelectorNodeInterface;
/**
 * Returns the only child of `node`.
 *
 * @param node Ast node.
 * @param errorMessage Error message.
 *
 * @returns The only child of ast node.
 * @throws An error if none or more than one child found.
 */
export declare const getNodeOnlyChild: (node: AnySelectorNodeInterface, errorMessage: string) => AnySelectorNodeInterface;
/**
 * Takes ExtendedSelector node and returns its only child.
 *
 * @param extendedSelectorNode ExtendedSelector ast node.
 *
 * @returns AbsolutePseudoClass or RelativePseudoClass.
 * @throws An error if there is no specific pseudo-class ast node.
 */
export declare const getPseudoClassNode: (extendedSelectorNode: AnySelectorNodeInterface) => AnySelectorNodeInterface;
/**
 * Takes RelativePseudoClass node and returns its only child
 * which is relative SelectorList node.
 *
 * @param pseudoClassNode RelativePseudoClass.
 *
 * @returns Relative SelectorList node.
 * @throws An error if no selector list found.
 */
export declare const getRelativeSelectorListNode: (pseudoClassNode: AnySelectorNodeInterface) => AnySelectorNodeInterface;
