/**
 * @file Public wrapper for the host-rule candidate check.
 */

import { HostRuleAstBuilder } from '../ast-builder/network/host-rule';

import type { ParserContext } from './context';

/**
 * Cheap token-stream check deciding whether a network-classified rule could be
 * an `/etc/hosts`-style host rule.
 *
 * @param ctx Parser context whose tokenizer output is loaded.
 *
 * @returns True if the rule may be a host rule.
 */
export function isHostRuleCandidate(ctx: ParserContext): boolean {
    return HostRuleAstBuilder.isCandidate(ctx);
}
