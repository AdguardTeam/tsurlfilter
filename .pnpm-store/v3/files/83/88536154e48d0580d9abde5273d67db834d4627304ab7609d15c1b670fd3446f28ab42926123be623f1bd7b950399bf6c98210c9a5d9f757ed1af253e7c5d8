/**
 * Possible ast node types.
 *
 * IMPORTANT: it is used as 'const' instead of 'enum' to avoid side effects
 * during ExtendedCss import into other libraries.
 */
export declare const NODE: {
    readonly SELECTOR_LIST: "SelectorList";
    readonly SELECTOR: "Selector";
    readonly REGULAR_SELECTOR: "RegularSelector";
    readonly EXTENDED_SELECTOR: "ExtendedSelector";
    readonly ABSOLUTE_PSEUDO_CLASS: "AbsolutePseudoClass";
    readonly RELATIVE_PSEUDO_CLASS: "RelativePseudoClass";
};
export declare type NodeType = typeof NODE[keyof typeof NODE];
/**
 * Universal interface for all node types.
 */
export interface AnySelectorNodeInterface {
    type: string;
    children: AnySelectorNodeInterface[];
    value?: string;
    name?: string;
    addChild(child: AnySelectorNodeInterface): void;
}
/**
 * Class needed for creating ast nodes while selector parsing.
 * Used for SelectorList, Selector, ExtendedSelector.
 */
export declare class AnySelectorNode implements AnySelectorNodeInterface {
    type: string;
    children: AnySelectorNodeInterface[];
    /**
     * Creates new ast node.
     *
     * @param type Ast node type.
     */
    constructor(type: NodeType);
    /**
     * Adds child node to children array.
     *
     * @param child Ast node.
     */
    addChild(child: AnySelectorNodeInterface): void;
}
/**
 * Class needed for creating RegularSelector ast node while selector parsing.
 */
export declare class RegularSelectorNode extends AnySelectorNode {
    value: string;
    /**
     * Creates RegularSelector ast node.
     *
     * @param value Value of RegularSelector node.
     */
    constructor(value: string);
}
/**
 * Class needed for creating RelativePseudoClass ast node while selector parsing.
 */
export declare class RelativePseudoClassNode extends AnySelectorNode {
    name: string;
    /**
     * Creates RegularSelector ast node.
     *
     * @param name Name of RelativePseudoClass node.
     */
    constructor(name: string);
}
/**
 * Class needed for creating AbsolutePseudoClass ast node while selector parsing.
 */
export declare class AbsolutePseudoClassNode extends AnySelectorNode {
    name: string;
    value: string;
    /**
     * Creates AbsolutePseudoClass ast node.
     *
     * @param name Name of AbsolutePseudoClass node.
     */
    constructor(name: string);
}
/**
 * Root node.
 *
 * SelectorList
 *   : Selector
 *     ...
 *   ;
 */
/**
 * Selector node.
 *
 * Selector
 *   : RegularSelector
 *   | ExtendedSelector
 *     ...
 *   ;
 */
/**
 * Regular selector node.
 * It can be selected by querySelectorAll().
 *
 * RegularSelector
 *   : type
 *   : value
 *   ;
 */
/**
 * Extended selector node.
 *
 * ExtendedSelector
 *   : AbsolutePseudoClass
 *   | RelativePseudoClass
 *   ;
 */
/**
 * Absolute extended pseudo-class node,
 * i.e. none-selector args.
 *
 * AbsolutePseudoClass
 *   : type
 *   : name
 *   : value
 *   ;
 */
/**
 * Relative extended pseudo-class node
 * i.e. selector as arg.
 *
 * RelativePseudoClass
 *   : type
 *   : name
 *   : SelectorList
 *   ;
 */
