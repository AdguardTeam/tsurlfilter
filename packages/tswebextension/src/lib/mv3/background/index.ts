// IMPORTANT! Re-exporting errors is necessary to correctly work on instanceof.
export {
    type ConversionError,
    EmptyResourcesError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
    type ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
    type LimitationError,
    MaxScannedRulesError,
    TooManyRegexpRulesError,
    TooManyUnsafeRulesError,
    TooManyRulesError,
    UnavailableFilterSourceError,
    UnavailableRuleSetSourceError,
    ResourceType,
    RULESET_NAME_PREFIX,
} from '@adguard/tsurlfilter/es/declarative-converter';

// re-exports to prevent collision, when both tsurlfilter and tswebextension are imported
export {
    getRuleSourceIndex,
    getRuleSourceText,
    type PreprocessedFilterList,
    FilterListPreprocessor,
    preprocessedFilterListValidator,
    type NetworkRule,
    type CosmeticRule,
    type NetworkRuleOption,
} from '@adguard/tsurlfilter';

export * from './app';

export { tabsApi } from '../tabs/tabs-api';
export { TabContext } from '../tabs/tab-context';
export { USER_FILTER_ID, MAIN_FRAME_ID } from '../../common/constants';

export type {
    ConfigurationMV3 as Configuration,
    SettingsConfigMV3 as SettingsConfig,
} from './configuration';
export { MessageType } from '../../common/message-constants';
export { companiesDbService } from '../../common/companies-db-service';
export {
    getDomain,
    isHttpRequest,
    isHttpOrWsRequest,
    isExtensionUrl,
} from '../../common/utils/url';
export { MESSAGE_HANDLER_NAME } from '../../common/message-constants';
export { type Message } from '../../common/message';
export { StealthActions } from '../../common/stealth-actions';
export { EventChannel, type EventChannelListener, type EventChannelInterface } from '../../common/utils/channels';
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
    type DeclarativeRuleEvent,
    type DeclarativeRuleInfo,
} from '../../common/filtering-log';
export { BACKGROUND_TAB_ID, LF } from '../../common/constants';
export { ContentType } from '../../common/request-type';
export type { RequestData } from './request/events/request-event';
export type { MessageHandler } from '../../common/app';
export type { LocalScriptFunctionData } from './services/local-script-rules-service';

export { TSWEBEXTENSION_VERSION, EXTENDED_CSS_VERSION } from '../../common/configuration';
