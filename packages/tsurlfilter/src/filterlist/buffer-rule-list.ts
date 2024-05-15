import { InputByteBuffer, RuleParser, type AnyRule } from '@adguard/agtree';
import { type FilterListSourceMap, getRuleSourceIndex } from './source-map';
import { BufferLineReader } from './reader/buffer-line-reader';
import { type IRuleList, LIST_ID_MAX_VALUE } from './rule-list';
import { RuleScanner } from './scanner/rule-scanner';
import { type ScannerType } from './scanner/scanner-type';
import { isString } from '../utils/string-utils';

/**
 * BufferRuleList represents a string-based rule list. It keeps the original
 * rule list as a byte array with UTF-8 encoded characters. This approach
 * allows saving on the memory used by tsurlfilter compared to StringRuleList.
 */
export class BufferRuleList<T extends string | AnyRule = string> implements IRuleList<T> {
    /**
     * Rule list ID.
     */
    private readonly id: number;

    /**
     * String with filtering rules (one per line) encoded as a
     * UTF-8 array.
     */
    private readonly rulesBuffer: Uint8Array | InputByteBuffer;

    /**
     * Whether to ignore cosmetic rules or not.
     */
    private readonly ignoreCosmetic: boolean;

    /**
     * Whether to ignore javascript cosmetic rules or not.
     */
    private readonly ignoreJS: boolean;

    /**
     * Whether to ignore unsafe rules or not.
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
     * @param listId - List identifier.
     * @param inputRules - String with filtering rules (one per line).
     * @param ignoreCosmetic - (Optional) True to ignore cosmetic rules.
     * @param ignoreJS - (Optional) True to ignore JS rules.
     * @param ignoreUnsafe - (Optional) True to ignore unsafe rules.
     * @param sourceMap - (Optional) Source map for the filter list.
     */
    constructor(
        listId: number,
        inputRules: string | InputByteBuffer,
        ignoreCosmetic?: boolean,
        ignoreJS?: boolean,
        ignoreUnsafe?: boolean,
        sourceMap?: FilterListSourceMap,
    ) {
        if (listId >= LIST_ID_MAX_VALUE) {
            throw new Error(`Invalid list identifier, it must be less than ${LIST_ID_MAX_VALUE}`);
        }

        this.id = listId;
        const encoder = new TextEncoder();

        // FIXME (David, v2.3): Change to InputByteBuffer-only
        if (isString(inputRules)) {
            this.rulesBuffer = encoder.encode(inputRules);
        } else {
            this.rulesBuffer = inputRules;
        }

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
     * @return - The rule list identifier
     */
    getId(): number {
        return this.id;
    }

    /**
     * Creates a new rules scanner that reads the list contents.
     *
     * @return - Scanner object.
     */
    newScanner(scannerType: ScannerType): RuleScanner<T> {
        const reader = new BufferLineReader<T>(this.rulesBuffer);

        return new RuleScanner(reader, this.id, {
            scannerType,
            ignoreCosmetic: this.ignoreCosmetic,
            ignoreJS: this.ignoreJS,
            ignoreUnsafe: this.ignoreUnsafe,
            sourceMap: this.sourceMap,
        });
    }

    /**
     * Finds rule text by its index.
     *
     * If there's no rule by that index or the rule is invalid, it will return
     * null.
     *
     * @param ruleIdx - rule index.
     * @return - rule text or null.
     */
    // FIXME (David, v2.3): Remove this method and only use `retrieveRuleNode`
    retrieveRuleText(ruleIdx: number): string | null {
        if (!(this.rulesBuffer instanceof Uint8Array)) {
            throw new Error('This method is not supported for InputByteBuffer');
        }

        if (ruleIdx < 0 || ruleIdx >= this.rulesBuffer.length) {
            return null;
        }

        let endOfLine = this.rulesBuffer.indexOf(BufferLineReader.EOL, ruleIdx);
        if (endOfLine === -1) {
            endOfLine = this.rulesBuffer.length;
        }

        const lineBuffer = this.rulesBuffer.subarray(ruleIdx, endOfLine);
        const line = BufferRuleList.decoder.decode(lineBuffer).trim();

        if (!line) {
            return null;
        }

        return line;
    }

    /**
     * Retrieves a rule node by its index.
     *
     * If there's no rule by that index or the rule is invalid, it will return
     * null.
     *
     * @param ruleIdx Rule index.
     * @return Rule node or `null`.
     */
    retrieveRuleNode(ruleIdx: number): AnyRule | null {
        // FIXME (David, v2.3): Remove this check after type union is removed
        if (!(this.rulesBuffer instanceof InputByteBuffer)) {
            throw new Error('This method is not supported for Uint8Array');
        }

        try {
            const ruleNode: AnyRule = {} as AnyRule;
            const copy = this.rulesBuffer.createCopyWithOffset(ruleIdx);
            RuleParser.deserialize(copy, ruleNode);
            return ruleNode;
        } catch (e) {
            // fall through
        }

        return null;
    }

    /**
     * @inheritdoc
     */
    retrieveRuleSourceIndex(ruleIdx: number): number {
        return getRuleSourceIndex(ruleIdx, this.sourceMap);
    }
}
