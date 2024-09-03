export declare type MatcherArgsData = {
    /**
     * Extended pseudo-class name.
     */
    pseudoName: string;
    /**
     * Extended pseudo-class arg.
     */
    pseudoArg: string;
    /**
     * Dom element to check.
     */
    domElement: Element;
};
/**
 * Checks whether the domElement is matched by :matches-css() arg.
 *
 * @param argsData Pseudo-class name, arg, and dom element to check.
 *
 @returns True if DOM element is matched.
 * @throws An error on invalid pseudo-class arg.
 */
export declare const isStyleMatched: (argsData: MatcherArgsData) => boolean;
/**
 * Returns valid arg for :matches-attr() and :matcher-property().
 *
 * @param rawArg Arg pattern.
 * @param [isWildcardAllowed=false] Flag for wildcard (`*`) using as pseudo-class arg.
 *
 * @returns Valid arg for :matches-attr() and :matcher-property().
 * @throws An error on invalid `rawArg`.
 */
export declare const getValidMatcherArg: (rawArg: string, isWildcardAllowed?: boolean) => string | RegExp;
declare type RawMatchingArgData = {
    rawName: string;
    rawValue?: string;
};
/**
 * Parses pseudo-class argument and returns parsed data.
 *
 * @param pseudoName Extended pseudo-class name.
 * @param pseudoArg Extended pseudo-class argument.
 *
 * @returns Parsed pseudo-class argument data.
 * @throws An error if attribute name is missing in pseudo-class arg.
 */
export declare const getRawMatchingData: (pseudoName: string, pseudoArg: string) => RawMatchingArgData;
/**
 * Checks whether the domElement is matched by :matches-attr() arg.
 *
 * @param argsData Pseudo-class name, arg, and dom element to check.
 *
 @returns True if DOM element is matched.
 * @throws An error on invalid arg of pseudo-class.
 */
export declare const isAttributeMatched: (argsData: MatcherArgsData) => boolean;
/**
 * Parses raw :matches-property() arg which may be chain of properties.
 *
 * @param input Argument of :matches-property().
 *
 * @returns Arg of :matches-property() as array of strings or regular expressions.
 * @throws An error on invalid chain.
 */
export declare const parseRawPropChain: (input: string) => (string | RegExp)[];
/**
 * Checks whether the domElement is matched by :matches-property() arg.
 *
 * @param argsData Pseudo-class name, arg, and dom element to check.
 *
 @returns True if DOM element is matched.
 * @throws An error on invalid prop in chain.
 */
export declare const isPropertyMatched: (argsData: MatcherArgsData) => boolean;
/**
 * Checks whether the textContent is matched by :contains arg.
 *
 * @param argsData Pseudo-class name, arg, and dom element to check.
 *
 @returns True if DOM element is matched.
 * @throws An error on invalid arg of pseudo-class.
 */
export declare const isTextMatched: (argsData: MatcherArgsData) => boolean;
export {};
