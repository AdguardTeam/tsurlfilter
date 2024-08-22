// re-exports to prevent collision, when both tsurlfilter and tswebextension are imported

export {
    NetworkRule,
    CosmeticRule,
    NetworkRuleOption,
    FilterListPreprocessor,
    type PreprocessedFilterList,
    type FilterListConversionMap,
    type FilterListSourceMap,
    getRuleSourceIndex,
    getRuleSourceText,
} from '@adguard/tsurlfilter';

// Re-export needed to print the library version on the extension About page.
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
export { companiesDbService } from '../../common/companies-db-service';
export { StealthActions } from '../../common/stealth-actions';
export type { MessageHandlerMV2 } from './messages-api';
export { MESSAGE_HANDLER_NAME } from '../../common/message-constants';
