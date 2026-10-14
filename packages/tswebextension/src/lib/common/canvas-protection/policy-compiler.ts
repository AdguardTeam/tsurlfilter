import { NetworkRuleType, RuleParser } from '@adguard/agtree';
import { createAllowlistRuleNode, SimpleRegex, StealthOptionName } from '@adguard/tsurlfilter';

import { logger } from '../utils/logger';

import {
    CanvasConditionFlags,
    CanvasConditionInput,
    CanvasConditionType,
    CanvasPolicyRequestType,
} from './constants';
import { type PreparedCondition, type PreparedPolicyRule, type ProtectionPolicyArtifact } from './contracts';

/**
 * Configured platform allowlist state.
 */
export interface PolicyAllowlist {
    readonly enabled: boolean;
    readonly inverted: boolean;
    readonly domains: readonly string[];
}

/**
 * Modifiers supported by host-only canvas exceptions.
 */
enum ExceptionModifier {
    Stealth = 'stealth',
    Document = 'document',
    Important = 'important',
}

/**
 * Prepares deterministic canvas exclusions from filter rules and the configured allowlist.
 */
export class CanvasPolicyCompiler {
    /**
     * Compiles supported network exceptions and the platform's allowlist semantics.
     *
     * @param ruleTexts Active exception rule texts, with badfilter cancellations already applied.
     * @param allowlist Configured allowlist state.
     *
     * @returns Seed-free policy, identical for equivalent inputs regardless of input order.
     */
    public static compile(ruleTexts: readonly string[], allowlist: PolicyAllowlist): ProtectionPolicyArtifact {
        const excludeMatches: string[] = [];
        const documentExclusions: PreparedPolicyRule[] = [];
        for (const text of ruleTexts) {
            let rule;
            try {
                rule = RuleParser.parse(text);
            } catch (error) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": parsing failed: ${error}`);
                continue;
            }
            if (rule.type !== NetworkRuleType.NetworkRule || rule.exception !== true) {
                continue;
            }
            const modifiers = rule.modifiers?.children ?? [];
            const document = modifiers.find((modifier) => modifier.name.value === ExceptionModifier.Document);
            const stealth = modifiers.find((modifier) => modifier.name.value === ExceptionModifier.Stealth);
            const fingerprinting = stealth !== undefined && (stealth.value === undefined
                || stealth.value.value.split('|').some((option) => option.trim() === StealthOptionName.Fingerprinting));
            if (!document && !fingerprinting) {
                continue;
            }
            const unsupportedModifier = modifiers.some((modifier) => {
                if (modifier.exception) {
                    return true;
                }
                switch (modifier.name.value) {
                    case ExceptionModifier.Stealth:
                        return false;
                    case ExceptionModifier.Document:
                    case ExceptionModifier.Important:
                        return modifier.value !== undefined;
                    default:
                        return true;
                }
            });
            if (unsupportedModifier) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": unsupported modifiers`);
                continue;
            }
            const pattern = rule.pattern.value;
            if (!pattern.startsWith('||') || !pattern.endsWith('^')) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": expected a ||host^ pattern`);
                continue;
            }
            const host = pattern.slice(2, -1);
            if (host.includes('*')) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": wildcard hosts are unsupported`);
                continue;
            }
            if (/[/?#:@[\]|^\\\s]/.test(host)) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": unsupported host characters`);
                continue;
            }
            let parsed: URL;
            try {
                parsed = new URL(`http://${host}`);
            } catch {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": invalid hostname`);
                continue;
            }
            if (!parsed.hostname || parsed.pathname !== '/' || parsed.search || parsed.hash) {
                logger.debug(`[tsweb.CanvasPolicyCompiler.compile]: Skipping rule "${text}": expected only a hostname`);
                continue;
            }
            const { hostname } = parsed;
            if (fingerprinting) {
                excludeMatches.push(/^\d+\.\d+\.\d+\.\d+$/.test(hostname)
                    ? `*://${hostname}/*` : `*://*.${hostname}/*`);
            }
            if (document) {
                documentExclusions.push(CanvasPolicyCompiler.documentExclusion(
                    CanvasPolicyCompiler.urlCondition(SimpleRegex.patternToRegexp(`||${hostname}^`)),
                ));
            }
        }
        if (allowlist.enabled) {
            if (allowlist.inverted) {
                const operands: PreparedCondition[] = [CanvasPolicyCompiler.urlCondition('^[^:/?#]+:///')];
                for (const domain of allowlist.domains) {
                    const pattern = domain.startsWith('*.')
                        ? `^[^:/?#]+://(?:www\\.[^./?#:]+|(?!www\\.)[^./?#:]+)\\.${SimpleRegex.escapeRegexSpecials(domain.slice(2))}\\.?(?::\\d+)?(?:[/?#]|$)`
                        : `^[^:/?#]+://(?:www\\.)?${SimpleRegex.escapeRegexSpecials(domain)}\\.?(?::\\d+)?(?:[/?#]|$)`;
                    operands.push(CanvasPolicyCompiler.urlCondition(pattern));
                }
                documentExclusions.push(CanvasPolicyCompiler.documentExclusion({
                    type: CanvasConditionType.Not,
                    operand: { type: CanvasConditionType.Or, operands: CanvasPolicyCompiler.sortedUnique(operands) },
                }));
            } else {
                for (const domain of allowlist.domains) {
                    const rule = createAllowlistRuleNode(domain);
                    if (rule) {
                        documentExclusions.push(CanvasPolicyCompiler.documentExclusion(
                            CanvasPolicyCompiler.urlCondition(SimpleRegex.patternToRegexp(rule.pattern.value)),
                        ));
                    }
                }
            }
        }
        const policy = {
            selectors: { matches: ['<all_urls>'], excludeMatches: [...new Set(excludeMatches)].sort() },
            ownFrameExclusions: [],
            documentExclusions: CanvasPolicyCompiler.sortedUnique(documentExclusions),
        };
        return { revision: CanvasPolicyCompiler.hash(JSON.stringify(policy)), ...policy };
    }

    /**
     * Creates a predicate evaluated against the top document's URL.
     *
     * @param pattern Regular expression source.
     *
     * @returns URL predicate.
     */
    private static urlCondition(pattern: string): PreparedCondition {
        return {
            type: CanvasConditionType.UrlRegexp,
            input: CanvasConditionInput.TopUrl,
            pattern,
            flags: CanvasConditionFlags.IgnoreCase,
        };
    }

    /**
     * Applies a predicate to the top document and its descendants.
     *
     * @param condition Top-document predicate.
     *
     * @returns Document exclusion.
     */
    private static documentExclusion(condition: PreparedCondition): PreparedPolicyRule {
        return { requestTypes: [CanvasPolicyRequestType.Document], condition };
    }

    /**
     * Sorts and deduplicates JSON values by their serialized representations.
     *
     * @param values Values to canonicalize.
     *
     * @returns Unique values in deterministic order.
     */
    private static sortedUnique<T>(values: readonly T[]): T[] {
        const entries = new Map(values.map((value) => [JSON.stringify(value), value]));
        return [...entries.keys()].sort().map((key) => entries.get(key)!);
    }

    /**
     * Computes 32-bit FNV-1a over UTF-16 character codes.
     *
     * @param text Canonical serialized policy.
     *
     * @returns Eight hexadecimal digits identifying the policy.
     */
    private static hash(text: string): string {
        let hash = 0x811c9dc5;
        for (let index = 0; index < text.length; index += 1) {
            hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
}
