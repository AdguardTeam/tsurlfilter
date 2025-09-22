import path from 'node:path';
import { ConfigurationMV2, ConvertedFilterList } from '@adguard/tswebextension';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = path.dirname(__filename);

import { BuildOutput } from '../constants';

export const BUILD_PATH = path.join(__dirname, '../build');

export const BACKGROUND_PATH = path.join(__dirname, '../extension/pages/background');

export const CONTENT_SCRIPT_PATH = path.join(__dirname, '../extension/pages/content-script');

export const POPUP_PATH = path.join(__dirname, '../extension/pages/popup');

export const DOCUMENT_BLOCKING_PATH = path.join(__dirname, '../extension/pages/document-blocking');

export const ASSISTANT_INJECT_PATH = path.join(__dirname, '../extension/pages/assistant-inject');

export const USER_DATA_PATH = path.join(__dirname, '../tmp');

export const TESTCASES_BASE_URL = 'https://testcases.agrd.dev';

export const TESTCASES_DATA_PATH = '/data.json';

const userrules = new ConvertedFilterList('');

export const DEFAULT_EXTENSION_CONFIG: ConfigurationMV2 = {
    filters: [],
    allowlist: [],
    trustedDomains: [],
    userrules: {
        content: userrules.getContent(),
        conversionData: userrules.getConversionData(),
    },
    verbose: false,
    settings: {
        assistantUrl: `${BuildOutput.AssistantInject}.js`,
        collectStats: true,
        debugScriptlets: false,
        allowlistInverted: false,
        allowlistEnabled: false,
        stealthModeEnabled: true,
        filteringEnabled: true,
        stealth: {
            blockChromeClientData: true,
            hideReferrer: true,
            hideSearchQueries: true,
            sendDoNotTrack: true,
            blockWebRTC: true,
            selfDestructThirdPartyCookies: true,
            selfDestructThirdPartyCookiesTime: 3600,
            selfDestructFirstPartyCookies: true,
            selfDestructFirstPartyCookiesTime: 3600,
        },
    },
};
