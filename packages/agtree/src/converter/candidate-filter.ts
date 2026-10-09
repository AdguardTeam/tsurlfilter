/**
 * @file Binary-view conversion-candidate pre-filter. Decides, from the
 * structural view alone (no AST), whether a scanned rule could possibly need
 * conversion. MUST be sound: it may over-select but never under-select a rule
 * the AST converter would change.
 */

import { NetworkRuleDataReader, type ParserContext, RuleKind } from '../parser';

/**
 * Decides whether a scanned rule is a conversion candidate.
 *
 * Network rules are candidates only when they carry at least one modifier — a
 * modifier-less network rule is a format-identical URL/host pattern that the
 * network converter never rewrites. Cosmetic rules and comments are always
 * candidates because plain element-hiding rules (extended-CSS rewriting) and
 * comment conversions can change them; skipping them is not provably sound.
 *
 * @param kind Structural rule kind from the scanner.
 * @param ctx Parser context populated by the scanner for this rule.
 *
 * @returns True when the rule must be materialized into an AST and converted.
 */
export function isConversionCandidate(kind: RuleKind, ctx: ParserContext): boolean {
    if (kind === RuleKind.Network) {
        return new NetworkRuleDataReader(ctx).modifierCount > 0;
    }
    // Cosmetic (RuleKind.Cosmetic) and Comment (RuleKind.Comment).
    return true;
}
