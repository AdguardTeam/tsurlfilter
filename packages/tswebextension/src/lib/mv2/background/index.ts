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
