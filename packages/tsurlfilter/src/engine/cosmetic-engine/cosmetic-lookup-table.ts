import { parse } from 'tldts';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { RuleStorage } from '../../filterlist/rule-storage';
import { Request } from '../../request';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { BinaryMap } from '../../utils/binary-map';
import type { ByteBuffer } from '../../utils/byte-buffer';

/**
 * CosmeticLookupTable lets quickly lookup cosmetic rules for the specified hostname.
 * It is primarily used by the {@see CosmeticEngine}.
 */
export class CosmeticLookupTable {
    /**
     * Map with rules indices grouped by the permitted domains names
     */
    private byHostname: Map<number, number>;

    /**
     * Collection of domain specific rules, those could not be grouped by domain name
     * For instance, wildcard domain rules.
     */
    public wildcardRules: CosmeticRule[];

    // FIXME remove
    // /**
    //  * Collection of generic rules.
    //  * Generic means that the rule is not limited to particular websites and works (almost) everywhere.
    //  */
    // public genericRules: CosmeticRule[];

    /**
     * Map with allowlist rules indices. Key is the rule content.
     * More information about allowlist here:
     * https://kb.adguard.com/en/general/how-to-create-your-own-ad-filters#element-hiding-rules-exceptions
     */
    private allowlist: Map<number, number>;

    /**
     * Storage for the filtering rules
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly byteBuffer: ByteBuffer;

    /**
     * Position of the allowlist binary map in the byte buffer.
     */
    declare private allowlistMapPosition: number;

    /**
     * Position of the hostname binary map in the byte buffer.
     */
    declare private hostnameMapPosition: number;

    declare private genericRulesPosition: number;

    declare private wildcardRulesPosition: number;

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage, byteBuffer: ByteBuffer) {
        this.byteBuffer = byteBuffer;
        this.byHostname = new Map();
        this.wildcardRules = [] as CosmeticRule[];
        this.wildcardRulesPosition = U32LinkedList.create(this.byteBuffer);
        this.genericRulesPosition = U32LinkedList.create(this.byteBuffer);
        this.allowlist = new Map();
        this.ruleStorage = storage;
    }

    /**
     * Adds rule to the appropriate collection
     * @param rule
     * @param storageIdx
     */
    public addRule(rule: CosmeticRule, storageIdx: number): void {
        if (rule.isAllowlist()) {
            this.addAllowlistRule(rule, storageIdx);
            return;
        }

        if (rule.isGeneric()) {
            this.addGenericRule(storageIdx);
            return;
        }

        this.addHostnameRule(rule, storageIdx);
    }

    /**
     * Finds rules by hostname
     * @param request
     * @param subdomains
     */
    public findByHostname(request: Request): CosmeticRule[] {
        const result = [] as CosmeticRule[];
        const { subdomains } = request;

        const matchStorageIndex = (storageIndexPosition: number): void => {
            const ruleIdx = this.byteBuffer.getUint32(storageIndexPosition);
            const listId = this.byteBuffer.getUint32(storageIndexPosition + 4);

            const rule = this.ruleStorage.retrieveRule(listId, ruleIdx) as CosmeticRule;
            if (rule && rule.match(request)) {
                result.push(rule);
            }
        };

        // Iterate over all sub-domains
        for (let i = 0; i < subdomains.length; i += 1) {
            const subdomain = subdomains[i];

            const hash = fastHash(subdomain);
            // FIXME conside remove
            // const storageIndexesPosition = BinaryMap.get(
            //     hash,
            //     this.byteBuffer,
            //     this.hostnameMapPosition,
            // );

            const storageIndexesPosition = this.byHostname.get(hash);

            if (storageIndexesPosition) {
                // FIXME: delete dups

                U32LinkedList.forEach(matchStorageIndex, this.byteBuffer, storageIndexesPosition);
            }
        }

        U32LinkedList.forEach((storageIndexPosition) => {
            const ruleIdx = this.byteBuffer.getUint32(storageIndexPosition);
            const listId = this.byteBuffer.getUint32(storageIndexPosition + 4);

            const rule = this.ruleStorage.retrieveRule(listId, ruleIdx) as CosmeticRule;
            if (rule && rule.match(request)) {
                result.push(rule);
            }
        }, this.byteBuffer, this.wildcardRulesPosition);

        return result.filter((rule) => !rule.isAllowlist());
    }

    /**
     * Checks if the rule is disabled on the specified hostname.
     * @param request
     * @param rule
     */
    public isAllowlisted(request: Request, rule: CosmeticRule): boolean {
        const hash = fastHash(rule.getContent());
        // FIXME consider remove
        // const storageIndexesPosition = BinaryMap.get(hash, this.byteBuffer, this.allowlistMapPosition);
        const storageIndexesPosition = this.allowlist.get(hash);

        if (!storageIndexesPosition) {
            return false;
        }

        const res = U32LinkedList.find((storageIndexPosition) => {
            const ruleId = this.byteBuffer.getUint32(storageIndexPosition);
            const listId = this.byteBuffer.getUint32(storageIndexPosition + 4);

            const r = this.ruleStorage.retrieveRule(listId, ruleId) as CosmeticRule;

            return r && r.match(request);
        }, this.byteBuffer, storageIndexesPosition);

        return res !== -1;
    }

    public finalize(): void {
        this.allowlistMapPosition = BinaryMap.create(this.allowlist, this.byteBuffer);
        this.hostnameMapPosition = BinaryMap.create(this.byHostname, this.byteBuffer);
    }

    private addAllowlistRule(rule: CosmeticRule, storageIdx: number): void {
        const key = rule.getContent();
        const hash = fastHash(key);

        const storageIndexPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addStorageIndex(storageIndexPosition, storageIdx);

        // Get the position of the storage indexes for the hash
        let storageIndexesPosition = this.allowlist.get(hash);

        /**
          * If the hash is not in the lookup table, create a new {@link U32LinkedList},
          */
        if (storageIndexesPosition === undefined) {
            storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
            this.allowlist.set(hash, storageIndexesPosition);
        }

        // Add the position of the storage index to the related U32LinkedList
        U32LinkedList.add(storageIndexPosition, this.byteBuffer, storageIndexesPosition);
    }

    private addGenericRule(storageIdx: number): void {
        const storageIndexPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addStorageIndex(storageIndexPosition, storageIdx);

        U32LinkedList.add(storageIndexPosition, this.byteBuffer, this.genericRulesPosition);
    }

    public forEachGenericRule(callback: (rule: CosmeticRule) => void): void {
        U32LinkedList.forEach((storageIndexPosition) => {
            const ruleIdx = this.byteBuffer.getUint32(storageIndexPosition);
            const listId = this.byteBuffer.getUint32(storageIndexPosition + 4);

            const rule = this.ruleStorage.retrieveRule(listId, ruleIdx) as CosmeticRule;
            if (rule) {
                callback(rule);
            }
        }, this.byteBuffer, this.genericRulesPosition);
    }

    private addHostnameRule(rule: CosmeticRule, storageIdx: number): void {
        const domains = rule.getPermittedDomains();

        if (!domains) {
            return;
        }

        const storageIndexPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addStorageIndex(storageIndexPosition, storageIdx);

        const hasWildcardDomain = domains.some((d) => DomainModifier.isWildcardDomain(d));

        if (hasWildcardDomain) {
            U32LinkedList.add(storageIndexPosition, this.byteBuffer, this.wildcardRulesPosition);
            return;
        }

        for (const domain of domains) {
            const tldResult = parse(domain);
            // tldResult.domain equals to eTLD domain,
            // e.g. sub.example.uk.org would result in example.uk.org
            const parsedDomain = tldResult.domain || domain;
            const hash = fastHash(parsedDomain);

            // Get the position of the storage indexes for the hash
            let storageIndexesPosition = this.byHostname.get(hash);

            /**
             * If the hash is not in the lookup table, create a new {@link U32LinkedList},
             */
            if (storageIndexesPosition === undefined) {
                storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
                this.byHostname.set(hash, storageIndexesPosition);
            }

            // Add the position of the storage index to the related U32LinkedList
            U32LinkedList.add(storageIndexPosition, this.byteBuffer, storageIndexesPosition);
        }
    }
}
