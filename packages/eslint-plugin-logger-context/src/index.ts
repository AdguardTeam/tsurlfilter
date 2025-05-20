/**
 * @file
 * Plugin for eslint that requires logger calls to start with a context tag,
 * e.g. "[ext.page-handler]:" or "[tsweb.WebRequestApi.onBeforeRequest]:".
 */
import { requireLoggerContextRule } from './require-logger-context';
import { name, version } from '../package.json';

export default {
    meta: {
        name,
        version,
    },
    rules: { 'require-logger-context': requireLoggerContextRule },
};
