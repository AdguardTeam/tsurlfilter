/* eslint-disable no-param-reassign */
import { getHostname, getDomain } from 'tldts';
import isIp from 'is-ip';

import { StringUtils } from '../../utils/string';
import {
    type HostRule,
    NetworkRuleType,
    RuleCategory,
    type Value,
} from '../../nodes/index.js';
import { defaultParserOptions } from '../options.js';
import { BaseParser } from '../base-parser.js';
import { AdblockSyntax } from '../../utils/adblockers.js';
import { ValueParser } from '../misc/value-parser.js';

/**
 * `HostRuleParser` is responsible for parsing hosts-like rules.
 *
 * HostRule is a structure for simple host-level rules (i.e. /etc/hosts syntax).
 * It also supports "just domain" syntax. In this case, the IP will be set to 0.0.0.0.
 *
 * Rules syntax looks like this:
 * ```text
 * IP_address canonical_hostname [aliases...]
 * ```
 *
 * @example
 * `192.168.1.13 bar.mydomain.org bar` -- ipv4
 * `ff02::1 ip6-allnodes` -- ipv6
 * `::1 localhost ip6-localhost ip6-loopback` -- ipv6 aliases
 * `example.org` -- "just domain" syntax
 * @see {@link http://man7.org/linux/man-pages/man5/hosts.5.html}
 */
export class HostRuleParser extends BaseParser {
    public static readonly NULL_IP = '0.0.0.0';

    public static readonly COMMENT_MARKER = '#';

    /**
     * Parses an etc/hosts-like rule.
     *
     * @param raw Raw input to parse.
     * @param options Global parser options.
     * @param baseOffset Starting offset of the input. Node locations are calculated relative to this offset.
     * @returns Host rule node.
     *
     * @throws If the input contains invalid data.
     */
    public static parse(raw: string, options = defaultParserOptions, baseOffset = 0): HostRule {
        let offset = StringUtils.skipWS(raw, 0);
        const parts: Value[] = [];
        let lastPartStartIndex = offset;
        let comment: Value | null = null;
        const rawLength = raw.length;

        const parsePartIfNeeded = (startIndex: number, endIndex: number): void => {
            if (startIndex < endIndex) {
                parts.push(ValueParser.parse(raw.slice(startIndex, endIndex), options, baseOffset + startIndex));
            }
        };

        while (offset < rawLength) {
            if (StringUtils.isWhitespace(raw[offset])) {
                parsePartIfNeeded(lastPartStartIndex, offset);
                offset = StringUtils.skipWS(raw, offset);
                lastPartStartIndex = offset;
            } else if (raw[offset] === HostRuleParser.COMMENT_MARKER) {
                const commentStart = offset;
                offset = StringUtils.skipWS(raw, offset + 1);
                comment = ValueParser.parse(raw.slice(offset), options, baseOffset + commentStart);
                offset = rawLength;
                lastPartStartIndex = offset;
            } else {
                offset += 1;
            }
        }

        parsePartIfNeeded(lastPartStartIndex, offset);

        const partsLength = parts.length;

        if (partsLength < 1) {
            throw new Error('Host rule must have at least one domain name or an IP address and a domain name');
        }

        const result: Partial<HostRule> = {
            category: RuleCategory.Network,
            type: NetworkRuleType.HostRule,
            syntax: AdblockSyntax.Common,
        };

        if (partsLength === 1) {
            // "Just domain" syntax, e.g. `example.org`
            // In this case, domain should be valid and IP will be set to 0.0.0.0 by default
            if (getDomain(parts[0].value) !== parts[0].value) {
                throw new Error(`Not a valid domain: ${parts[0].value}`);
            }

            result.ip = {
                type: 'Value',
                value: HostRuleParser.NULL_IP,
            };

            result.hostnames = {
                type: 'HostnameList',
                children: parts,
            };
        } else if (partsLength > 1) {
            // IP + domain list syntax
            const [ip, ...hostnames] = parts;

            if (!isIp(ip.value)) {
                throw new Error(`Invalid IP address: ${ip.value}`);
            }

            for (const { value } of hostnames) {
                if (getHostname(value) !== value) {
                    throw new Error(`Not a valid hostname: ${value}`);
                }
            }

            result.ip = ip;

            result.hostnames = {
                type: 'HostnameList',
                children: hostnames,
            };
        }

        if (comment) {
            result.comment = comment;
        }

        if (options.includeRaws) {
            result.raws = {
                text: raw,
            };
        }

        return result as HostRule;
    }
}
