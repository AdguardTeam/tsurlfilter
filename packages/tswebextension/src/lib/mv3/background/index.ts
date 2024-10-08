import {
    type ConversionError,
    EmptyResourcesError,
    TooComplexRegexpError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
    type ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRegexpRulesError,
    ResourcesPathError,
    type LimitationError,
    TooManyRegexpRulesError,
    TooManyRulesError,
    UnavailableFilterSourceError,
    UnavailableRuleSetSourceError,
} from '@adguard/tsurlfilter/es/declarative-converter';

export * from './app';

export { USER_FILTER_ID } from './user-rules-api';
export { tabsApi } from '../tabs/tabs-api';
export { TabContext } from '../tabs/tab-context';
export { MAIN_FRAME_ID } from '../tabs/frame';
export type { ConfigurationMV3 as Configuration } from './configuration';
export { CommonMessageType, ExtendedMV3MessageType } from './messages';
export { RULE_SET_NAME_PREFIX } from './filters-api';
export {
    getDomain,
    isHttpRequest,
    isHttpOrWsRequest,
    isExtensionUrl,
} from '../../common/utils/url';
export {
    defaultFilteringLog,
    FilteringEventType,
    type SendRequestEvent,
    type ReceiveResponseEvent,
    type TabReloadEvent,
    type RemoveParamEvent,
    type RemoveHeaderEvent,
    type ApplyCosmeticRuleEvent,
    type ApplyBasicRuleEvent,
    type ApplyCspRuleEvent,
    type CookieEvent,
    type JsInjectEvent,
    type ReplaceRuleApplyEvent,
    type StealthActionEvent,
    type CspReportBlockedEvent,
} from '../../common/filtering-log';
export { BACKGROUND_TAB_ID } from '../../common/constants';
export { ContentType } from '../../common/request-type';

// re-exports to prevent collision, when both tsurlfilter and tswebextension are imported
export {
    NetworkRule,
    CosmeticRule,
    NetworkRuleOption,
} from '@adguard/tsurlfilter';

// IMPORTANT! Re-exporting errors is necessary to correctly work on instanceof.
export {
    type ConversionError,
    EmptyResourcesError,
    TooComplexRegexpError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
    type ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRegexpRulesError,
    ResourcesPathError,
    type LimitationError,
    TooManyRegexpRulesError,
    TooManyRulesError,
    UnavailableFilterSourceError,
    UnavailableRuleSetSourceError,
};
