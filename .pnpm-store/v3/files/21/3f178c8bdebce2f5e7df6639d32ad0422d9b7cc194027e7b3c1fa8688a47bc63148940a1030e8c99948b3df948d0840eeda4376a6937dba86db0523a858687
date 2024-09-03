/**
 * Describes possible style declaration parts.
 *
 * IMPORTANT: it is used as 'const' instead of 'enum' to avoid side effects
 * during ExtendedCss import into other libraries.
 */
declare const DECLARATION_PART: {
    readonly PROPERTY: "property";
    readonly VALUE: "value";
};
declare type DeclarationPart = typeof DECLARATION_PART[keyof typeof DECLARATION_PART];
export declare type StyleDeclaration = {
    [key in DeclarationPart]: string;
};
declare type QuoteMark = '"' | "'";
/**
 * Interface for style declaration parser context.
 */
export declare type Context = {
    /**
     * Collection of parsed style declarations.
     */
    styles: StyleDeclaration[];
    /**
     * Current processing part of style declaration — 'property' or 'value'.
     */
    processing: DeclarationPart;
    /**
     * Needed for collecting style property.
     */
    bufferProperty: string;
    /**
     * Needed for collecting style value.
     */
    bufferValue: string;
    /**
     * Buffer for style value quote mark.
     * Needed for proper quoter balancing.
     */
    valueQuoteMark: QuoteMark | null;
};
/**
 * Parses css rule style block.
 *
 * @param rawStyleBlock Style block to parse.
 *
 * @returns Array of style declarations.
 * @throws An error on invalid style block.
 */
export declare const parseStyleBlock: (rawStyleBlock: string) => StyleDeclaration[];
export {};
