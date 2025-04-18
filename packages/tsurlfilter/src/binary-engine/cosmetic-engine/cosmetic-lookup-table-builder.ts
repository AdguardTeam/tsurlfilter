import { parse } from 'tldts';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Builder } from '../builder';
import { CosmeticLookupTable } from './cosmetic-lookup-table';
import { ByteBuffer } from '../../utils/byte-buffer';
import { type IndexedStorageRule } from '../../rules/rule';
import { BinaryUint32ToUint32ListMap } from '../../utils/binary-uint32-to-uint32list-map';
import { BinaryStringToUint32ListMap } from '../../utils/binary-string-to-uint32list-map';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { CosmeticLookupTableByteOffsets } from '../byte-offsets';

export class CosmeticLookupTableBuilder implements Builder<CosmeticLookupTable> {
    private built: boolean;

    private readonly buffer: ByteBuffer;

    /**
     * Map with rules indices grouped by the permitted domains names.
     */
    private byHostname: Map<number, number[]>;

    /**
     * List of domain-specific rules that are not organized into any index structure.
     * These rules are sequentially scanned one by one.
     */
    public seqScanRules: CosmeticRule[];

    /**
     * Collection of generic rules.
     * Generic means that the rule is not limited to particular websites and works (almost) everywhere.
     */
    public genericRules: CosmeticRule[];

    /**
     * Map with allowlist rules indices. Key is the rule content.
     *
     * @see {@link https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules-exceptions}
     */
    private allowlist: Map<string, number[]>;

    /**
     * Storage for the filtering rules.
     */
    private readonly storage: RuleStorage;

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage) {
        this.built = false;
        this.buffer = new ByteBuffer();
        this.byHostname = new Map();
        this.seqScanRules = [] as CosmeticRule[];
        this.genericRules = [] as CosmeticRule[];
        this.allowlist = new Map();
        this.storage = storage;
    }

    /**
     * Adds rule to the allowlist map.
     *
     * @param key Can be used any string, but here we use ruleContent, scriptlet content, or scriptlet name.
     * @param storageIdx Index of the rule.
     */
    private addAllowlistRule(key: string, storageIdx: number): void {
        const existingRules = this.allowlist.get(key);
        if (!existingRules) {
            this.allowlist.set(key, [storageIdx]);
            return;
        }
        existingRules.push(storageIdx);
    }

    /**
     * Adds rule to the appropriate collection.
     *
     * @param rule Indexed storage rule to add.
     *
     * @returns True if the rule was added, false otherwise.
     *
     * @throws If the lookup table has already been built.
     */
    public addRule(rule: IndexedStorageRule): boolean {
        if (this.built) {
            throw new Error('Cannot add rules after the lookup table has been built');
        }

        if (!(rule.rule instanceof CosmeticRule)) {
            return false;
        }

        if (rule.rule.isAllowlist()) {
            if (rule.rule.isScriptlet) {
                // Store scriptlet rules by name to enable the possibility of allowlisting them.
                // See https://github.com/AdguardTeam/Scriptlets/issues/377 for more details.
                if (rule.rule.scriptletParams.name !== undefined
                    && rule.rule.scriptletParams.args.length === 0) {
                    this.addAllowlistRule(rule.rule.scriptletParams.name, rule.index);
                }
                // Use normalized scriptlet content for better matching.
                // For example, //scriptlet('log', 'arg') can be matched by //scriptlet("log", "arg").
                this.addAllowlistRule(rule.rule.scriptletParams.toString(), rule.index);
            } else {
                // Store all other rules by their content.
                this.addAllowlistRule(rule.rule.getContent(), rule.index);
            }
            return true;
        }

        if (rule.rule.isGeneric()) {
            this.genericRules.push(rule.rule);
            return true;
        }

        const permittedDomains = rule.rule.getPermittedDomains();
        if (permittedDomains) {
            if (permittedDomains.some(DomainModifier.isWildcardOrRegexDomain)) {
                this.seqScanRules.push(rule.rule);
                return true;
            }
            for (const domain of permittedDomains) {
                const tldResult = parse(domain);
                // tldResult.domain equals to eTLD domain,
                // e.g. sub.example.uk.org would result in example.uk.org
                const parsedDomain = tldResult.domain || domain;
                const key = fastHash(parsedDomain);
                const rules = this.byHostname.get(key) || [] as number[];
                rules.push(rule.index);
                this.byHostname.set(key, rules);
            }
            return true;
        }
        return false;
    }

    public build(buffer: ByteBuffer): CosmeticLookupTable {
        if (this.built) {
            throw new Error('Cannot build the lookup table after it has been built');
        }

        const offset = buffer.byteOffset;

        // allocate space for the offsets
        buffer.addUint32(offset + CosmeticLookupTableByteOffsets.ByHostname, 0);
        buffer.addUint32(offset + CosmeticLookupTableByteOffsets.Allowlist, 0);
        buffer.addUint32(offset + CosmeticLookupTableByteOffsets.SeqScanRules, 0);
        buffer.addUint32(offset + CosmeticLookupTableByteOffsets.GenericRules, 0);

        // by hostname
        const byHostnameOffset = buffer.byteOffset;
        BinaryUint32ToUint32ListMap.create(this.byHostname, this.buffer);
        buffer.setUint32(offset + CosmeticLookupTableByteOffsets.ByHostname, byHostnameOffset);

        // allowlist
        const allowlistOffset = buffer.byteOffset;
        BinaryStringToUint32ListMap.create(this.allowlist, this.buffer);
        buffer.setUint32(offset + CosmeticLookupTableByteOffsets.Allowlist, allowlistOffset);

        // seq scan rules
        const seqScanRulesOffset = U32LinkedList.create(this.buffer);
        for (const rule of this.seqScanRules) {
            U32LinkedList.add(rule.getIndex(), this.buffer, seqScanRulesOffset);
        }
        buffer.setUint32(offset + CosmeticLookupTableByteOffsets.SeqScanRules, seqScanRulesOffset);

        // generic rules
        const genericRulesOffset = U32LinkedList.create(this.buffer);
        for (const rule of this.genericRules) {
            U32LinkedList.add(rule.getIndex(), this.buffer, genericRulesOffset);
        }
        buffer.setUint32(offset + CosmeticLookupTableByteOffsets.GenericRules, genericRulesOffset);

        this.built = true;

        return new CosmeticLookupTable(
            this.storage,
            buffer,
            offset,
        );
    }
}
