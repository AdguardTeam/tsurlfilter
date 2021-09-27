import { NetworkRule } from '../rules/network-rule';
import { HostRule } from '../rules/host-rule';

/**
 * DnsResult contains a network rule and host rules matching request
 */
export class DnsResult {
    /**
     * BasicRule - a network rule matching the request.
     */
    public basicRule: NetworkRule | null = null;

    /**
     * Host rules
     */
    public hostRules: HostRule[] = [];
}
