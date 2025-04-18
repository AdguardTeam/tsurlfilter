export const enum NetworkEngineByteOffsets {
    DomainsLookupTable = 0,
    HostnameLookupTable = 4,
    ShortcutsLookupTable = 8,
    SeqScanLookupTable = 12,
}

export const enum CosmeticEngineByteOffsets {
    RulesCount = 0,
    ElementHidingLookupTable = 4,
    CssLookupTable = 8,
    JsLookupTable = 12,
    HtmlLookupTable = 16,
}

export const enum CosmeticLookupTableByteOffsets {
    ByHostname = 0,
    Allowlist = 4,
    SeqScanRules = 8,
    GenericRules = 12,
}

export const enum DnsEngineByteOffsets {
    RulesCount = 0,
    LookupTable = 4,
    NetworkEngine = 8,
}
