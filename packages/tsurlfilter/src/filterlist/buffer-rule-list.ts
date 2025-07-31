import { type AnyRule } from '@adguard/agtree';
import { RuleDeserializer } from '@adguard/agtree/deserializer';
import { InputByteBuffer } from '@adguard/agtree/utils';

import { BufferReader } from './reader/buffer-reader';
import { type IRuleList, LIST_ID_MAX_VALUE } from './rule-list';
import { RuleScanner } from './scanner/rule-scanner';
import { type ScannerType } from './scanner/scanner-type';
import { type FilterListSourceMap, getRuleSourceIndex } from './source-map';

/**
 * BufferRuleList represents a string-based rule list. It keeps the original
 * rule list as a byte array with UTF-8 encoded characters. This approach
 * allows saving on the memory used by tsurlfilter compared to StringRuleList.
 */
export class BufferRuleList implements IRuleList {
    /**
     * Rule list ID.
     */
    private readonly id: number;

    /**
     * String with filtering rules (one per line) encoded as a
     * UTF-8 array.
     */
    private readonly rulesBuffer: InputByteBuffer;

    /**
     * Whether to ignore cosmetic rules or not.
     */
    private readonly ignoreCosmetic: boolean;

    /**
     * Whether to ignore javascript cosmetic rules or not.
     */
    private readonly ignoreJS: boolean;

    /**
     * Whether to ignore unsafe (e.g. $removeheader) rules or not.
     */
    private readonly ignoreUnsafe: boolean;

    /**
     * Source map for the filter list.
     */
    private readonly sourceMap: FilterListSourceMap;

    /**
     * Text decoder that is used to read strings from the internal buffer of
     * UTF-8 encoded characters.
     */
    private static readonly decoder = new TextDecoder('utf-8');

    /**
     * Constructor of BufferRuleList.
     *
     * @param listId List identifier.
     * @param inputRules String with filtering rules (one per line).
     * @param ignoreCosmetic (Optional) True to ignore cosmetic rules.
     * @param ignoreJS (Optional) True to ignore JS rules.
     * @param ignoreUnsafe (Optional) True to ignore unsafe rules.
     * @param sourceMap (Optional) Source map for the filter list.
     */
    constructor(
        listId: number,
        inputRules: Uint8Array[],
        ignoreCosmetic?: boolean,
        ignoreJS?: boolean,
        ignoreUnsafe?: boolean,
        sourceMap?: FilterListSourceMap,
    ) {
        if (listId >= LIST_ID_MAX_VALUE) {
            throw new Error(`Invalid list identifier, it must be less than ${LIST_ID_MAX_VALUE}`);
        }

        this.id = listId;
        this.rulesBuffer = new InputByteBuffer(inputRules);
        this.ignoreCosmetic = !!ignoreCosmetic;
        this.ignoreJS = !!ignoreJS;
        this.ignoreUnsafe = !!ignoreUnsafe;
        this.sourceMap = sourceMap ?? {};
    }

    /**
     * Close does nothing as here's nothing to close in the BufferRuleList.
     */
    // eslint-disable-next-line class-methods-use-this
    public close(): void {
        // Empty
    }

    /**
     * Gets the rule list identifier.
     *
     * @returns The rule list identifier.
     */
    public getId(): number {
        return this.id;
    }

    /**
     * Creates a new rules scanner that reads the list contents.
     *
     * @param scannerType The type of scanner to create.
     *
     * @returns Scanner object.
     */
    public newScanner(scannerType: ScannerType): RuleScanner {
        const reader = new BufferReader(this.rulesBuffer.createCopyWithOffset(0));

        return new RuleScanner(reader, this.id, {
            scannerType,
            ignoreCosmetic: this.ignoreCosmetic,
            ignoreJS: this.ignoreJS,
            ignoreUnsafe: this.ignoreUnsafe,
        });
    }

    /**
     * Retrieves a rule node by its index.
     *
     * If there's no rule by that index or the rule is invalid, it will return
     * null.
     *
     * @param ruleIdx Rule index.
     *
     * @returns Rule node or `null`.
     */
    public retrieveRuleNode(ruleIdx: number): AnyRule | null {
        try {
            const ruleNode: AnyRule = {} as AnyRule;
            const copy = this.rulesBuffer.createCopyWithOffset(ruleIdx);
            RuleDeserializer.deserialize(copy, ruleNode);
            return ruleNode;
        } catch (e) {
            // fall through
        }

        return null;
    }

    /**
     * @inheritdoc
     */
    public retrieveRuleSourceIndex(ruleIdx: number): number {
        return getRuleSourceIndex(ruleIdx, this.sourceMap);
    }
}
