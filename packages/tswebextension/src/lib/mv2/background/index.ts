// re-exports to prevent collision, when both tsurlfilter and tswebextension are imported
export {
    NetworkRule,
    CosmeticRule,
    CosmeticRuleType,
    NetworkRuleOption,
    FilterListPreprocessor,
    type PreprocessedFilterList,
    type FilterListConversionMap,
    type FilterListSourceMap,
    getRuleSourceIndex,
    getRuleSourceText,
    RuleCategorizer,
} from '@adguard/tsurlfilter';

// Re-export needed to print libraries version in extension popup.
// NOTE: Do not export anything from extended-css in MV3 environment to prevent
// environment runtime errors, like call window.console, which is not available
// in the service worker in MV3.
export { EXTENDED_CSS_VERSION } from '@adguard/extended-css';

export * from './api';
export * from './app';
export * from './ext-session-storage';
export * from './tabs';
export * from './request';
export * from '../../common';
export * from './configuration';
export { StealthActions } from './services/stealth-service';
export type { MessageHandlerMV2 } from './messages-api';
