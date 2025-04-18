import { CosmeticRuleType } from '@adguard/agtree';

import { type RuleStorage } from '../../filterlist/rule-storage';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { type Builder } from '../builder';
import { CosmeticEngine } from './cosmetic-engine';
import { CosmeticLookupTableBuilder } from './cosmetic-lookup-table-builder';
import { type IndexedStorageRule } from '../../rules/rule';
import { ByteBuffer } from '../../utils/byte-buffer';
import { CosmeticEngineByteOffsets } from '../byte-offsets';

export class CosmeticEngineBuilder implements Builder<CosmeticEngine> {
    private built: boolean;

    private readonly storage: RuleStorage;

    private readonly buffer: ByteBuffer;

    private rulesCount: number;

    private readonly elementHidingLookupTableBuilder: CosmeticLookupTableBuilder;

    private readonly cssLookupTableBuilder: CosmeticLookupTableBuilder;

    private readonly jsLookupTableBuilder: CosmeticLookupTableBuilder;

    private readonly htmlLookupTableBuilder: CosmeticLookupTableBuilder;

    constructor(ruleStorage: RuleStorage) {
        this.storage = ruleStorage;
        this.built = false;
        this.buffer = new ByteBuffer();

        this.rulesCount = 0;

        this.elementHidingLookupTableBuilder = new CosmeticLookupTableBuilder(ruleStorage);
        this.cssLookupTableBuilder = new CosmeticLookupTableBuilder(ruleStorage);
        this.jsLookupTableBuilder = new CosmeticLookupTableBuilder(ruleStorage);
        this.htmlLookupTableBuilder = new CosmeticLookupTableBuilder(ruleStorage);
    }

    /**
     * Adds rules into appropriate tables.
     *
     * @param rule Indexed storage rule to add.
     */
    public addRule(rule: IndexedStorageRule): void {
        if (this.built) {
            throw new Error('Cannot add rules after the lookup table has been built');
        }

        if (!(rule.rule instanceof CosmeticRule)) {
            return;
        }

        switch (rule.rule.getType()) {
            case CosmeticRuleType.ElementHidingRule: {
                this.elementHidingLookupTableBuilder.addRule(rule);
                break;
            }
            case CosmeticRuleType.CssInjectionRule: {
                this.cssLookupTableBuilder.addRule(rule);
                break;
            }
            case CosmeticRuleType.ScriptletInjectionRule: {
                this.jsLookupTableBuilder.addRule(rule);
                break;
            }
            case CosmeticRuleType.JsInjectionRule: {
                this.jsLookupTableBuilder.addRule(rule);
                break;
            }
            case CosmeticRuleType.HtmlFilteringRule: {
                this.htmlLookupTableBuilder.addRule(rule);
                break;
            }
            default: {
                break;
            }
        }

        this.rulesCount += 1;
    }

    public build(buffer: ByteBuffer): CosmeticEngine {
        if (this.built) {
            throw new Error('Cannot build the lookup table after it has been built');
        }

        this.built = true;

        const offset = buffer.byteOffset;

        // allocate space for the offsets
        buffer.addUint32(offset + CosmeticEngineByteOffsets.RulesCount, 0);
        buffer.addUint32(offset + CosmeticEngineByteOffsets.ElementHidingLookupTable, 0);
        buffer.addUint32(offset + CosmeticEngineByteOffsets.CssLookupTable, 0);
        buffer.addUint32(offset + CosmeticEngineByteOffsets.JsLookupTable, 0);
        buffer.addUint32(offset + CosmeticEngineByteOffsets.HtmlLookupTable, 0);

        // rules count
        const rulesCountOffset = buffer.byteOffset + CosmeticEngineByteOffsets.RulesCount;
        buffer.setUint32(rulesCountOffset, this.rulesCount);

        // element hiding lookup table
        const elementHidingLookupTableOffset = buffer.byteOffset;
        this.elementHidingLookupTableBuilder.build(buffer);
        buffer.setUint32(offset + CosmeticEngineByteOffsets.ElementHidingLookupTable, elementHidingLookupTableOffset);

        // css lookup table
        const cssLookupTableOffset = buffer.byteOffset;
        this.cssLookupTableBuilder.build(buffer);
        buffer.setUint32(offset + CosmeticEngineByteOffsets.CssLookupTable, cssLookupTableOffset);

        // js lookup table
        const jsLookupTableOffset = buffer.byteOffset;
        this.jsLookupTableBuilder.build(buffer);
        buffer.setUint32(offset + CosmeticEngineByteOffsets.JsLookupTable, jsLookupTableOffset);

        // html lookup table
        const htmlLookupTableOffset = buffer.byteOffset;
        this.htmlLookupTableBuilder.build(buffer);
        buffer.setUint32(offset + CosmeticEngineByteOffsets.HtmlLookupTable, htmlLookupTableOffset);

        return new CosmeticEngine(
            this.storage,
            buffer,
            offset,
        );
    }
}
