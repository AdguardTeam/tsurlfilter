import { type CosmeticRule } from '../../rules/cosmetic-rule';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type Request } from '../../request';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { BinaryStringToUint32ListMap } from '../../utils/binary-string-to-uint32list-map';
import { fastHash } from '../../utils/string-utils';
import { BinaryUint32ToUint32ListMap } from '../../utils/binary-uint32-to-uint32list-map';
import { CosmeticLookupTableByteOffsets } from '../byte-offsets';

/**
 * CosmeticLookupTable lets quickly lookup cosmetic rules for the specified hostname.
 * It is primarily used by the {@link CosmeticEngine}.
 */
export class CosmeticLookupTable {
    declare public readonly offset: number;

    /**
     * Storage for the filtering rules.
     */
    private readonly storage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly buffer: ByteBuffer;

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     * @param buffer Byte buffer to store the binary data.
     * @param offset Byte offset of the lookup table in the {@link buffer}.
     */
    constructor(
        storage: RuleStorage,
        buffer: ByteBuffer,
        offset: number,
    ) {
        this.storage = storage;
        this.buffer = buffer;
        this.offset = offset;
    }

    /**
     * Finds rules by hostname.
     *
     * @param request Request to check.
     *
     * @returns Array of matching cosmetic rules.
     */
    findByHostname(request: Request): CosmeticRule[] {
        const result = [] as CosmeticRule[];
        const { subdomains } = request;
        for (let i = 0; i < subdomains.length; i += 1) {
            const hash = fastHash(subdomains[i]);
            const rulesIndexes = new Set(BinaryUint32ToUint32ListMap.get(
                hash,
                this.buffer,
                this.offset + CosmeticLookupTableByteOffsets.ByHostname,
            ));
            if (rulesIndexes) {
                for (const ruleIndex of rulesIndexes) {
                    const rule = this.storage.retrieveRule(ruleIndex) as CosmeticRule;
                    if (rule && !rule.isAllowlist() && rule.match(request)) {
                        result.push(rule);
                    }
                }
            }
        }

        U32LinkedList.forEach((storageIdx) => {
            const rule = this.storage.retrieveRule(storageIdx) as CosmeticRule;
            if (rule && !rule.isAllowlist() && rule.match(request)) {
                result.push(rule);
            }
        }, this.buffer, this.offset + CosmeticLookupTableByteOffsets.SeqScanRules);

        return result;
    }

    /**
     * Checks if a scriptlet is allowlisted for a request. It looks up the scriptlet
     * by content in the allowlist map and evaluates two conditions:
     * 1. If there's a generic allowlist rule applicable to all sites.
     * 2. If there's a specific allowlist rule that matches the request.
     *
     * @param content Content of the scriptlet. Empty string '' searches for scriptlets allowlisted globally.
     * @param request Request details to match against allowlist rules.
     *
     * @returns True if allowlisted by a matching rule or a generic rule. False otherwise.
     */
    isScriptletAllowlisted = (content: string, request: Request): boolean => {
        // check for rules with that content
        const allowlistScriptletRulesIndexes = BinaryStringToUint32ListMap.get(
            content,
            this.buffer,
            this.offset + CosmeticLookupTableByteOffsets.Allowlist,
        );

        if (allowlistScriptletRulesIndexes) {
            const rules = allowlistScriptletRulesIndexes
                .map((i) => {
                    return this.storage.retrieveRule(i) as CosmeticRule;
                })
                .filter(Boolean);

            // here we check if there is at least one generic allowlist rule
            const hasAllowlistGenericScriptlet = rules.some((r) => {
                return r.isGeneric();
            });

            if (hasAllowlistGenericScriptlet) {
                return true;
            }

            // here we check if there is at least one allowlist rule that matches the request
            const hasRuleMatchingRequest = rules.some((r) => r.match(request));
            if (hasRuleMatchingRequest) {
                return true;
            }
        }

        return false;
    };

    /**
     * Checks if the rule is disabled on the specified hostname.
     *
     * @param request Request to check.
     * @param rule Rule to check.
     *
     * @returns True if the rule is disabled on the specified hostname.
     */
    isAllowlisted(request: Request, rule: CosmeticRule): boolean {
        if (rule.isScriptlet) {
            // Empty string '' is a special case for scriptlet when the allowlist scriptlet has no name
            // e.g. #@%#//scriptlet(); example.org#@%#//scriptlet();
            const EMPTY_SCRIPTLET_NAME = '';
            if (this.isScriptletAllowlisted(EMPTY_SCRIPTLET_NAME, request)) {
                return true;
            }

            // If scriptlet allowlisted by name
            // e.g. #@%#//scriptlet('set-cookie'); example.org#@%#//scriptlet('set-cookie');
            if (rule.scriptletParams.name !== undefined
                && this.isScriptletAllowlisted(rule.scriptletParams.name, request)) {
                return true;
            }

            // If scriptlet allowlisted with args, using normalized scriptlet content for better matching
            // on different quote types (see https://github.com/AdguardTeam/AdguardBrowserExtension/issues/2947)
            // e.g. #@%#//scriptlet("set-cookie", "arg1"); example.org#@%#//scriptlet('set-cookie', 'arg1');
            if (rule.scriptletParams.name !== undefined
                && rule.scriptletParams.args.length > 0
                && this.isScriptletAllowlisted(rule.scriptletParams.toString(), request)) {
                return true;
            }
        }

        const rulesIndexes = BinaryStringToUint32ListMap.get(
            rule.getContent(),
            this.buffer,
            this.offset + CosmeticLookupTableByteOffsets.Allowlist,
        );
        if (!rulesIndexes) {
            return false;
        }

        for (let j = 0; j < rulesIndexes.length; j += 1) {
            const r = this.storage.retrieveRule(rulesIndexes[j]) as CosmeticRule;
            if (r && r.match(request)) {
                return true;
            }
        }

        return false;
    }

    // FIXME: Improve performance
    public get genericRules(): CosmeticRule[] {
        U32LinkedList.forEach((storageIdx) => {
            const rule = this.storage.retrieveRule(storageIdx) as CosmeticRule;
            if (rule && !rule.isAllowlist() && rule.isGeneric()) {
                this.genericRules.push(rule);
            }
        }, this.buffer, this.offset + CosmeticLookupTableByteOffsets.GenericRules);
        return this.genericRules;
    }
}
