/**
 * @file
 * Plugin for eslint that requires logger calls to start with a context tag,
 * e.g. "[ext.page-handler]:" or "[tsweb.WebRequestApi.onBeforeRequest]:".
 */
import { requireLoggerContextRule } from './require-logger-context';

export default {
    meta: {
        name: 'eslint-plugin-require-logger-context',
        version: '1.0.0',
    },
    rules: { 'require-logger-context': requireLoggerContextRule },
};
