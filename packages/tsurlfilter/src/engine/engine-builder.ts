/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */
import { NetworkRule } from '../rules/network-rule';
import { type RuleStorage } from '../filterlist/rule-storage';
import { ScannerType } from '../filterlist/scanner/scanner-type';
import { type IndexedStorageRule } from '../rules/rule';
import { CosmeticRule } from '../rules/cosmetic-rule';
import { Engine } from './engine-1';
import { type Builder } from './builder';
import { NetworkEngineBuilder } from './network-engine-2-builder';
import { CosmeticEngineBuilder } from './cosmetic-engine-1/cosmetic-engine-builder';
import { ByteBuffer } from '../utils/byte-buffer';
import { EngineByteOffsets } from './byte-offsets';

/**
 * Engine represents the filtering engine with all the loaded rules.
 */
export class EngineBuilder implements Builder<Engine> {
    private built: boolean;

    private readonly buffer: ByteBuffer;

    private readonly networkEngineBuilder: NetworkEngineBuilder;

    /**
     * Cosmetic rules engine.
     */
    private readonly cosmeticEngineBuilder: CosmeticEngineBuilder;

    /**
     * Rules storage.
     */
    private readonly storage: RuleStorage;

    constructor(ruleStorage: RuleStorage) {
        this.built = false;
        this.storage = ruleStorage;
        this.buffer = new ByteBuffer();

        this.networkEngineBuilder = new NetworkEngineBuilder(ruleStorage);
        this.cosmeticEngineBuilder = new CosmeticEngineBuilder(ruleStorage);
    }

    /**
     * Loads rules to engine.
     */
    public loadRules(): void {
        const scanner = this.storage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        while (scanner.scan()) {
            this.addRule(scanner.getRule());
        }
    }

    /**
     * Async loads rules to engine.
     *
     * @param chunkSize Size of rules chunk to load at a time.
     */
    public async loadRulesAsync(chunkSize: number): Promise<void> {
        const scanner = this.storage.createRuleStorageScanner(ScannerType.NetworkRules | ScannerType.CosmeticRules);

        let counter = 0;
        while (scanner.scan()) {
            counter += 1;

            if (counter >= chunkSize) {
                counter = 0;

                /**
                 * In some cases UI thread becomes blocked while adding rules to engine,
                 * that't why we create filter rules using chunks of the specified length
                 * Rules creation is rather slow operation so we should
                 * use setTimeout calls to give UI thread some time.
                 */
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            this.addRule(scanner.getRule());
        }
    }

    /**
     * Adds rules to engines.
     *
     * @param indexedRule Rule to add.
     */
    public addRule(indexedRule: IndexedStorageRule | null): void {
        if (indexedRule) {
            if (indexedRule.rule instanceof NetworkRule) {
                this.networkEngineBuilder.addRule(indexedRule);
            } else if (indexedRule.rule instanceof CosmeticRule) {
                this.cosmeticEngineBuilder.addRule(indexedRule);
            }
        }
    }

    public build(buffer: ByteBuffer): Engine {
        if (this.built) {
            throw new Error('Cannot build the engine after it has been built');
        }

        this.built = true;

        const offset = buffer.byteOffset;

        // allocate space for the offsets
        buffer.addUint32(offset + EngineByteOffsets.NetworkEngine, EngineByteOffsets.NetworkEngine);
        buffer.addUint32(offset + EngineByteOffsets.CosmeticEngine, EngineByteOffsets.CosmeticEngine);

        // build network engine
        buffer.setUint32(offset + EngineByteOffsets.NetworkEngine, buffer.byteOffset);
        this.networkEngineBuilder.build(buffer);

        // build cosmetic engine
        buffer.setUint32(offset + EngineByteOffsets.CosmeticEngine, buffer.byteOffset);
        this.cosmeticEngineBuilder.build(buffer);

        return new Engine(this.storage, buffer, offset);
    }
}
