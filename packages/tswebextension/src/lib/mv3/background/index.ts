import {
    type ConversionError,
    EmptyResourcesError,
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

export {
    getRuleSourceIndex,
    getRuleSourceText,
    type PreprocessedFilterList,
    FilterListPreprocessor,
} from '@adguard/tsurlfilter';

export * from './app';

export { USER_FILTER_ID } from './user-rules-api';
export { tabsApi } from '../tabs/tabs-api';
export { TabContext } from '../tabs/tab-context';
export { MAIN_FRAME_ID } from '../tabs/frame';
export type {
    ConfigurationMV3 as Configuration,
    SettingsConfigMV3 as SettingsConfig,
} from './configuration';
export { CommonMessageType, ExtendedMV3MessageType } from './messages';
export { RULE_SET_NAME_PREFIX } from './filters-api';
export {
    getDomain,
    isHttpRequest,
    isHttpOrWsRequest,
    isExtensionUrl,
} from '../../common/utils/url';
export { MESSAGE_HANDLER_NAME } from '../../common/message-constants';
export { type Message } from '../../common/message';
export { StealthActions } from '../../common/stealth-actions';
export { EventChannel, type EventChannelListener } from '../../common/utils/channels';
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
    type StealthAllowlistActionEvent,
    type ApplyPermissionsRuleEvent,
} from '../../common/filtering-log';
export { BACKGROUND_TAB_ID } from '../../common/constants';
export { ContentType } from '../../common/request-type';
export type { RequestData } from './request/events/request-event';
export type { MessagesHandlerMV3 } from './messages-api';

// re-exports to prevent collision, when both tsurlfilter and tswebextension are imported
export type {
    NetworkRule,
    CosmeticRule,
    CosmeticRuleType,
    NetworkRuleOption,
} from '@adguard/tsurlfilter';

export { TSWEBEXTENSION_VERSION } from '../../common/configuration';

// IMPORTANT! Re-exporting errors is necessary to correctly work on instanceof.
export {
    type ConversionError,
    EmptyResourcesError,
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
