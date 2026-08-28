import { RuleCategory } from '../nodes';
import { RuleClassifier } from '../parser/classifier';
import { createParserContext, initParserContext, type ParserContext } from '../parser/context';
import { TokenType } from '../tokenizer/token-types';
import { Tokenizer } from '../tokenizer/tokenizer';

/**
 * Lookup table: maps internal {@link RuleKind} numeric values to the
 * corresponding {@link RuleCategory} string values.
 */
const KIND_TO_CATEGORY: readonly RuleCategory[] = [
    RuleCategory.Network, // RuleKind.Network = 0
    RuleCategory.Comment, // RuleKind.Comment = 1
    RuleCategory.Cosmetic, // RuleKind.Cosmetic = 2
];

/**
 * Efficient, tokenization-based rule categorizer.
 *
 * Unlike a full AST parser, this class only tokenizes the input and uses
 * the token stream to determine the rule's category. It is designed for
 * high-throughput batch classification of filter-list rules.
 *
 * @example
 * ```typescript
 * import { RuleCategorizer, RuleCategory } from '@adguard/agtree';
 *
 * const categorizer = new RuleCategorizer();
 *
 * categorizer.categorize('||example.com^');        // RuleCategory.Network
 * categorizer.categorize('example.com##.banner');  // RuleCategory.Cosmetic
 * categorizer.categorize('! comment');             // RuleCategory.Comment
 * categorizer.categorize('');                      // RuleCategory.Empty
 * ```
 */
export class RuleCategorizer {
    /**
     * Internal tokenizer instance, reused across calls.
     */
    private readonly tokenizer: Tokenizer;

    /**
     * Internal parser context, reused across calls.
     */
    private readonly ctx: ParserContext;

    /**
     * Creates a new `RuleCategorizer` instance with pre-allocated internal
     * buffers. Reuse a single instance across many `categorize()` calls for
     * optimal performance.
     *
     * @param tokenCapacity Maximum number of tokens to support per rule.
     *   Defaults to 1024, which is sufficient for virtually all real-world
     *   filter rules.
     */
    constructor(tokenCapacity = 1024) {
        this.tokenizer = new Tokenizer(tokenCapacity);
        this.ctx = createParserContext(tokenCapacity);
    }

    /**
     * Categorizes a raw adblock filter rule string into one of the main rule
     * categories: {@link RuleCategory.Empty}, {@link RuleCategory.Comment},
     * {@link RuleCategory.Cosmetic}, or {@link RuleCategory.Network}.
     *
     * This method performs **tokenization-level classification only** — it does
     * NOT parse the full AST and does NOT validate the rule. As a result, it
     * accepts syntactically invalid rules without throwing and returns a
     * best-effort category based on the token structure.
     *
     * @param rule The raw rule string to categorize.
     *
     * @returns The {@link RuleCategory} of the rule.
     */
    public categorize(rule: string): RuleCategory {
        // Tokenize the input
        this.tokenizer.setSource(rule);

        const { tokenCount } = this.tokenizer;

        // Empty string produces 0 tokens; whitespace-only produces 1 Whitespace token
        if (tokenCount === 0
            || (tokenCount === 1 && this.tokenizer.types[0] === TokenType.Whitespace)) {
            return RuleCategory.Empty;
        }

        // Initialize context from tokenizer output
        initParserContext(this.ctx, rule, this.tokenizer);

        // Classify using the zero-allocation classifier
        const packed = RuleClassifier.classify(this.ctx, 0, tokenCount);
        const kind = RuleClassifier.ruleKind(packed);
        return KIND_TO_CATEGORY[kind] ?? RuleCategory.Network;
        return KIND_TO_CATEGORY[kind];
    }
}
