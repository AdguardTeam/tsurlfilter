/**
 * Scanner types enum
 */
export enum ScannerType {
    /**
     * Scanning for network rules
     */
    NetworkRules = 0,
    /**
     * Scanning for cosmetic rules
     */
    CosmeticRules = 1 << 1,
    /**
     * Scanning for host rules
     */
    HostRules = 1 << 2,
    /**
     * All
     */
    All = NetworkRules | CosmeticRules | HostRules
}
