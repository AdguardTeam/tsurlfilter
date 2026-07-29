/**
 * @file Host rule AST builder — parses `/etc/hosts`-style rules into HostRule
 * nodes. String-based (mirrors the removed legacy HostRuleParser); gated behind
 * the `parseHostRules` option in the pipeline.
 */

import isIp from 'is-ip';
import { getDomain, getHostname } from 'tldts';

import type { HostRule, Value } from '../../nodes';
import { NetworkRuleType, NodeType, RuleCategory } from '../../nodes';
import type { ParserContext } from '../../parser/context';
import { TokenType } from '../../tokenizer/token-types';
import { StringUtils } from '../../utils/string';
import { SYNTAX_ALL } from '../../utils/syntax-flags';
import type { ParseOptions } from '../options';

/**
 * Default IP address for the "just domain" host syntax.
 */
const NULL_IP = '0.0.0.0';

/**
 * Comment marker inside a host rule.
 */
const COMMENT_MARKER = '#';

/**
 * Token-type lookup: `1` for token types that can legally appear in an
 * `/etc/hosts` line (letters, digits, `-`, `_`, non-ASCII, whitespace, line
 * breaks, `.`, `:`, and `#` for the trailing comment). Any other token type
 * (e.g. `|`, `^`, `$`, `/`, `@`, `*`) means the rule is definitely NOT a host
 * rule, so the candidate scan bails immediately. Indexed by `TokenType`.
 */
const HOST_LEGAL_TOKEN = ((): Uint8Array => {
    const table = new Uint8Array(64);
    for (const type of [
        TokenType.Letter,
        TokenType.Hyphen,
        TokenType.Digit,
        TokenType.Underscore,
        TokenType.NonAscii,
        TokenType.Eof,
        TokenType.Whitespace,
        TokenType.LineBreak,
        TokenType.HashMark,
        TokenType.Dot,
        TokenType.Colon,
    ]) {
        table[type] = 1;
    }
    return table;
})();

interface RawPart {
    value: string;
    start: number;
    end: number;
}

/**
 * Builds `HostRule` nodes from `/etc/hosts`-style input.
 */
export class HostRuleAstBuilder {
    /**
     * Cheap O(1)-amortized gate deciding whether a network-classified rule
     * could be a host rule, using the already-computed token stream. A normal
     * network rule contains an adblock-syntax token (`|`, `^`, `$`, `/`, `@`,
     * `*`, …) — usually at token 0 — so this early-exits without touching the
     * source string. Only genuine host candidates scan to the end. This keeps
     * the string-based host parser off the network hot path (see plan R7).
     *
     * @param ctx Parser context whose tokenizer output is loaded.
     *
     * @returns `true` if the rule may be a host rule and is worth a full parse.
     */
    public static isCandidate(ctx: ParserContext): boolean {
        const { types, tokenCount } = ctx;

        for (let i = 0; i < tokenCount; i += 1) {
            const type = types[i];
            // The rest of the line is a `#comment` — host-legal; stop scanning.
            if (type === TokenType.HashMark) {
                break;
            }
            if (HOST_LEGAL_TOKEN[type] !== 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * Parses a host rule string into a HostRule node.
     *
     * @param source Raw rule string.
     * @param options Parse options (only `isLocIncluded` is used here).
     *
     * @returns A `HostRule` node, or `null` if `source` is not a valid host
     * rule (so the caller can fall back to network parsing).
     */
    public static parse(source: string, options: ParseOptions = {}): HostRule | null {
        const isLoc = options.isLocIncluded ?? false;
        const len = source.length;

        const parts: RawPart[] = [];
        let comment: RawPart | null = null;

        let i = 0;
        while (i < len && StringUtils.isWhitespace(source[i])) {
            i += 1;
        }
        let partStart = i;

        while (i < len) {
            const ch = source[i];
            if (StringUtils.isWhitespace(ch)) {
                if (i > partStart) {
                    parts.push({ value: source.slice(partStart, i), start: partStart, end: i });
                }
                while (i < len && StringUtils.isWhitespace(source[i])) {
                    i += 1;
                }
                partStart = i;
            } else if (ch === COMMENT_MARKER) {
                // Preserve the raw comment including the # and any trailing
                // text so source reconstruction and diagnostics remain accurate.
                comment = { value: source.slice(i), start: i, end: len };
                i = len;
                partStart = len;
            } else {
                i += 1;
            }
        }

        if (partStart < i) {
            parts.push({ value: source.slice(partStart, i), start: partStart, end: i });
        }

        if (parts.length < 1) {
            return null;
        }

        const toValue = (part: RawPart): Value => {
            const value: Value = { type: NodeType.Value, value: part.value };
            if (isLoc) {
                value.start = part.start;
                value.end = part.end;
            }
            return value;
        };

        let ip: Value;
        let hostnameParts: RawPart[];

        if (parts.length === 1) {
            // "Just domain" syntax, e.g. `example.org`.
            if (getDomain(parts[0].value) !== parts[0].value) {
                return null;
            }
            ip = { type: NodeType.Value, value: NULL_IP };
            hostnameParts = [parts[0]];
        } else {
            // IP + hostname list syntax.
            const [ipPart, ...rest] = parts;
            if (!isIp(ipPart.value)) {
                return null;
            }
            for (const hostname of rest) {
                if (getHostname(hostname.value) !== hostname.value) {
                    return null;
                }
            }
            ip = toValue(ipPart);
            hostnameParts = rest;
        }

        const result: HostRule = {
            type: NetworkRuleType.HostRule,
            category: RuleCategory.Network,
            syntax: SYNTAX_ALL,
            ip,
            hostnames: {
                type: NodeType.HostnameList,
                children: hostnameParts.map(toValue),
            },
        };

        if (comment) {
            result.comment = { type: NodeType.Value, value: comment.value };
            if (isLoc) {
                result.comment.start = comment.start;
                result.comment.end = comment.end;
            }
        }

        if (isLoc) {
            result.start = 0;
            result.end = len;
        }

        return result;
    }
}
