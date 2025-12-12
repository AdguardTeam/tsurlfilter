/* eslint-disable no-console */
import browser from 'webextension-polyfill';
import {
    AdguardApi,
    type Configuration,
    MESSAGE_HANDLER_NAME,
    type RequestBlockingEvent,
} from '@adguard/api-mv3';

// Import pre-built local script rules (copied during build)
// @ts-expect-error Importing local script rules from js file without declaration file
import { localScriptRules as localScriptRulesJs } from '../filters/local_script_rules';
import { extraScripts } from './extra-scripts';
import { ENABLED_FILTERS_IDS } from '../../constants';

(async (): Promise<void> => {
    // create new AdguardApi instance with local script rules
    const adguardApi = await AdguardApi.create({
        localScriptRulesJs,
    });

    // console log event on request blocking
    const onRequestBlocked = (event: RequestBlockingEvent) => {
        console.log(event);
    };

    adguardApi.onRequestBlocked.addListener(onRequestBlocked);

    let configuration: Configuration = {
        filters: ENABLED_FILTERS_IDS.map((id) => Number(id)),
        filteringEnabled: true,
        allowlist: ['www.example.com'],
        /* eslint-disable @typescript-eslint/quotes */
        rules: [
            'example.org##h1',
            // These two scripts rules will be injected anytime
            `#%#//scriptlet('log', 'generic scriptlet injected')`,
            `example.net#%#//scriptlet('log', 'specific scriptlet injected')`,
            // These two scripts rules will be injected only if UserScripts Permission is granted
            `#%#console.log('generic script injected at: ', Date.now());`,
            `example.net#%#console.log('specific script injected at: ', Date.now());`,
            // These scripts are explicitly added to local_script_rules.js,
            // so they will be injected as well anytime
            ...extraScripts,
        ],
        /* eslint-enable @typescript-eslint/quotes */
        assetsPath: 'filters',
        documentBlockingPageUrl: browser.runtime.getURL('blocking-page.html'),
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log('Total rules count:', adguardApi.getRulesCount());
    };

    try {
        configuration = await adguardApi.start(configuration);
        console.log('Finished Adguard API initialization.');
        console.log('Applied configuration: ', JSON.stringify(configuration));
        logTotalCount();
    } catch (error) {
        console.error('Failed to start AdGuard API:', error);
        return;
    }

    configuration.allowlist!.push('www.google.com');

    try {
        await adguardApi.configure(configuration);
        console.log('Finished Adguard API re-configuration');
        logTotalCount();
    } catch (error) {
        console.error('Failed to configure AdGuard API:', error);
    }

    const onAssistantCreateRule = async (rule: string) => {
        // update config on assistant rule apply
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        try {
            await adguardApi.configure(configuration);
            console.log('Finished Adguard API re-configuration');
            logTotalCount();
        } catch (error) {
            console.error('Failed to apply assistant rule:', error);
        }
    };

    adguardApi.onAssistantCreateRule.subscribe(onAssistantCreateRule);

    // get tswebextension message handler
    const handleApiMessage = adguardApi.getMessageHandler();

    // define custom message handler
    const handleAppMessage = async (message: any) => {
        switch (message.type) {
            case 'OPEN_ASSISTANT': {
                // We need the last focused window because if the assistant is opened in incognito mode,
                // it won’t be clear where to inject the assistant. AG-42726
                const currentWindow = await browser.windows.getLastFocused();
                const [activeTab] = await browser.tabs.query({ active: true, windowId: currentWindow.id });
                if (activeTab?.id) {
                    await adguardApi.openAssistant(activeTab.id);
                }
                break;
            }
            default:
            // do nothing
        }
    };

    browser.runtime.onMessage.addListener(async (message, sender) => {
        // route message depending on handler name
        if (message?.handlerName === MESSAGE_HANDLER_NAME) {
            return Promise.resolve(handleApiMessage(message, sender));
        }
        return handleAppMessage(message);
    });

    // Disable Adguard in 2 minute, since one minute might not be enough for testing
    setTimeout(async () => {
        adguardApi.onRequestBlocked.removeListener(onRequestBlocked);
        adguardApi.onAssistantCreateRule.unsubscribe(onAssistantCreateRule);
        await adguardApi.stop();
        console.log('Adguard API MV3 has been disabled.');
    }, 2 * 60 * 1000);
})();
