import { BufferLineReader } from './reader/buffer-line-reader';
import { type IRuleList, LIST_ID_MAX_VALUE } from './rule-list';
import { RuleScanner } from './scanner/rule-scanner';
import { type ScannerType } from './scanner/scanner-type';

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
    private readonly rulesBuffer: Uint8Array;

    /**
     * Whether to ignore cosmetic rules or not.
     */
    private readonly ignoreCosmetic: boolean;

    /**
     * Whether to ignore javascript cosmetic rules or not.
     */
    private readonly ignoreJS: boolean;

    /**
     * Whether to ignore unsafe rules or not (e.g. removeheader)
     */
    private readonly ignoreUnsafe: boolean;

    /**
     * Text decoder that is used to read strings from the internal buffer of
     * UTF-8 encoded characters.
     */
    private static readonly decoder = new TextDecoder('utf-8');

    /**
     * Constructor of BufferRuleList.
     *
     * @param listId - List identifier.
     * @param rulesText - String with filtering rules (one per line).
     * @param ignoreCosmetic - (Optional) True to ignore cosmetic rules.
     * @param ignoreJS - (Optional) True to ignore JS rules.
     * @param ignoreUnsafe - (Optional) True to ignore unsafe rules (e.g. removeheader).
     */
    constructor(
        listId: number,
        rulesText: string,
        ignoreCosmetic?: boolean,
        ignoreJS?: boolean,
        ignoreUnsafe?: boolean,
    ) {
        if (listId >= LIST_ID_MAX_VALUE) {
            throw new Error(`Invalid list identifier, it must be less than ${LIST_ID_MAX_VALUE}`);
        }

        this.id = listId;
        const encoder = new TextEncoder();
        this.rulesBuffer = encoder.encode(rulesText);
        this.ignoreCosmetic = !!ignoreCosmetic;
        this.ignoreJS = !!ignoreJS;
        this.ignoreUnsafe = !!ignoreUnsafe;
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
    newScanner(scannerType: ScannerType): RuleScanner {
        const reader = new BufferLineReader(this.rulesBuffer);
        return new RuleScanner(reader, this.id, {
            scannerType,
            ignoreCosmetic: this.ignoreCosmetic,
            ignoreJS: this.ignoreJS,
            ignoreUnsafe: this.ignoreUnsafe,
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
    retrieveRuleText(ruleIdx: number): string | null {
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
}
