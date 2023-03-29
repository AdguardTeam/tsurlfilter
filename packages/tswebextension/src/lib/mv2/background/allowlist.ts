import { NetworkRule, StringRuleList } from '@adguard/tsurlfilter';
import { Configuration } from '../../common/configuration';
import { getDomain } from '../../common/utils/url';
import { engineApi } from './engine-api';

/**
 * Allowlist service.
 */
export class AllowlistApi {
    static allowlistFilterId = 100;

    domains: string[] = [];

    inverted = false;

    enabled = false;

    /**
     * Configures allowlist state based on app configuration.
     *
     * @param configuration App configuration.
     */
    public configure(configuration: Configuration): void {
        const {
            allowlist,
            settings,
        } = configuration;

        const {
            allowlistEnabled,
            allowlistInverted,
        } = settings;

        this.enabled = allowlistEnabled;
        this.inverted = allowlistInverted;

        const domains: string[] = [];

        allowlist.forEach((hostname) => {
            domains.push(hostname.startsWith('www.') ? hostname.substring(4) : hostname);
        });

        this.domains = domains;
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): StringRuleList | null {
        if (this.enabled && !this.inverted) {
            return new StringRuleList(
                AllowlistApi.allowlistFilterId,
                this.domains.map((domain) => {
                    return AllowlistApi.createAllowlistRuleString(domain);
                }).join('\n'),
            );
        }

        return null;
    }

    /**
     * Match frame rule based on allowlist state.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        /**
         * If inverted allowlist enabled, use specific matching strategy.
         */
        if (this.enabled && this.inverted) {
            return this.matchFrameInverted(frameUrl);
        }

        /**
         * If allowlist mode is default, request rule from engine.
         * If allowlist is enabled, rules have already loaded.
         */
        return engineApi.matchFrame(frameUrl);
    }

    /**
     * Creates allowlist rule for domains that are not in the inverted list.
     * In other cases returns engine matched rule.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    private matchFrameInverted(frameUrl: string): NetworkRule | null {
        const domain = getDomain(frameUrl);

        if (!domain) {
            return null;
        }

        if (!this.domains.includes(domain)) {
            return AllowlistApi.createAllowlistRule(domain);
        }

        return engineApi.matchFrame(frameUrl);
    }

    /**
     * Creates allowlist rule for domain.
     *
     * @param domain Domain name.
     * @returns Allowlist rule or null.
     */
    private static createAllowlistRule(domain: string): null | NetworkRule {
        if (!domain) {
            return null;
        }

        const ruleString = AllowlistApi.createAllowlistRuleString(domain);

        return new NetworkRule(ruleString, AllowlistApi.allowlistFilterId);
    }

    /**
     * Creates rule string based on specified domain.
     *
     * @param domain Allowlisted domain.
     * @returns Allowlist rule string.
     */
    private static createAllowlistRuleString(domain: string): string {
        return String.raw`@@///(www\.)?${domain}/$document,important`;
    }
}

export const allowlistApi = new AllowlistApi();
