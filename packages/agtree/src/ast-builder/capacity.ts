/**
 * @file Parser capacity configuration.
 */

/**
 * Capacity configuration for pipeline parser constructors.
 *
 * All fields are optional. Each pipeline parser defines its own defaults
 * for fields it uses.
 */
export interface ParserCapacity {
    /**
     * Maximum number of tokens per tokenize call.
     *
     * @default 1024
     */
    tokenCapacity?: number;

    /**
     * Maximum items in the primary data region (modifiers, selectors,
     * hints, agents, etc.).
     *
     * @default 64
     */
    itemCapacity?: number;

    /**
     * Maximum items in the secondary data region (domains).
     *
     * @default 128
     */
    secondaryCapacity?: number;

    /**
     * Whether buffers may grow dynamically on overflow (up to hard caps).
     *
     * When `false`, overflow sets `status = 1` and the pipeline parser throws.
     * When `true` (default), buffers grow automatically up to the hard caps.
     *
     * @default true
     */
    grow?: boolean;
}
