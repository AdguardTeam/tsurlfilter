import { type HostRule } from '../rules/host-rule';
import { type NetworkRule } from '../rules/network-rule';

/**
 * DnsResult contains a network rule and host rules matching request.
 */
export class DnsResult {
    /**
     * BasicRule - a network rule matching the request.
     */
    public basicRule: NetworkRule | null = null;

    /**
     * Host rules.
     */
    public hostRules: HostRule[] = [];
}
