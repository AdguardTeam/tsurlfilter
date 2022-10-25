/* eslint-disable no-console */
import { FilteringEventType, FilteringLogEvent, MESSAGE_HANDLER_NAME } from "@adguard/tswebextension";
import { AdguardApi, AdguardApiConfiguration } from "@adguard/api";

(async (): Promise<void> => {
    const adguardApi = new AdguardApi({
        resourcesPath: "war",
        filterRulesUrl: "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
        filtersMetadataUrl: "https://filters.adtidy.org/extension/chromium/filters.json",
    });

    // console log request data on basic rule apply
    const onFilteringLogEvent = (event: FilteringLogEvent) => {
        if (event.type === FilteringEventType.APPLY_BASIC_RULE) {
            console.log(event.data);
        }
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log("Total rules count:", adguardApi.tswebextension.getRulesCount());
    };

    adguardApi.onFilteringLogEvent.subscribe(onFilteringLogEvent);

    const config: AdguardApiConfiguration = {
        filters: [2],
        allowlist: ["www.avira.com"],
        trustedDomains: [], // hide?
        userrules: ["example.org##h1"],
        verbose: false,
        settings: {
            filteringEnabled: true,
            stealthModeEnabled: true,
            collectStats: true, // hide?
            allowlistInverted: false, // public?
            allowlistEnabled: true,
            stealth: {
                blockChromeClientData: false,
                hideReferrer: false,
                hideSearchQueries: false,
                sendDoNotTrack: false,
                blockWebRTC: false,
                selfDestructThirdPartyCookies: true,
                selfDestructThirdPartyCookiesTime: 3600,
                selfDestructFirstPartyCookies: true,
                selfDestructFirstPartyCookiesTime: 3600,
            },
        },
    };

    await adguardApi.start(config);

    console.log("Finished Adguard API initialization.");
    logTotalCount();

    config.allowlist.push("www.google.com");

    await adguardApi.configure(config);

    console.log("Finished Adguard API re-configuration");
    logTotalCount();

    // update config on assistant rule apply
    adguardApi.onAssistantCreateRule.subscribe(async (rule) => {
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        config.userrules.push(rule);
        await adguardApi.configure(config);
        console.log("Finished Adguard API re-configuration");
        logTotalCount();
    });

    const tsWebExtensionMessageHandler = adguardApi.tswebextension.getMessageHandler();

    // add assistant message listener
    chrome.runtime.onMessage.addListener((message, sender): Promise<unknown> | void => {
        if (message.handlerName === MESSAGE_HANDLER_NAME) {
            return tsWebExtensionMessageHandler(message, sender);
        }

        switch (message.type) {
            case "OPEN_ASSISTANT": {
                chrome.tabs.query({ active: true }, (res) => {
                    if (res.length > 0 && res[0].id) {
                        adguardApi.openAssistant(res[0].id);
                    }
                });
                break;
            }
            default:
            // do nothing
        }
    });

    // Disable Adguard in 1 minute
    setTimeout(async () => {
        adguardApi.tswebextension.onFilteringLogEvent.unsubscribe(onFilteringLogEvent);
        await adguardApi.stop();
        console.log("Adguard API has been disabled.");
    }, 60 * 1000);
})();
