import {
    ConversionError,
    EmptyResourcesError,
    TooComplexRegexpError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
    ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRegexpRulesError,
    ResourcesPathError,
    LimitationError,
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
export { ConfigurationMV3 as Configuration } from './configuration';
export { CommonMessageType, ExtendedMV3MessageType } from './messages';
export { RULE_SET_NAME_PREFIX } from './filters-api';
export {
    getDomain,
    isHttpRequest,
    isHttpOrWsRequest,
} from '../../common/utils/url';

// IMPORTANT! Re-exporting errors is necessary to correctly work on instanceof.
export {
    ConversionError,
    EmptyResourcesError,
    TooComplexRegexpError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
    InvalidDeclarativeRuleError,
    ConverterOptionsError,
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRegexpRulesError,
    ResourcesPathError,
    LimitationError,
    TooManyRegexpRulesError,
    TooManyRulesError,
    UnavailableFilterSourceError,
    UnavailableRuleSetSourceError,
};
