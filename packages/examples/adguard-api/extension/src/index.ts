/* eslint-disable no-console */
import browser from "webextension-polyfill";
import { FilteringEventType, FilteringLogEvent } from "@adguard/tswebextension";
import { AdguardApi, Configuration } from "@adguard/api";

(async (): Promise<void> => {
    const configuration: Configuration = {
        filters: [2],
        whitelist: ["www.avira.com"],
        rules: ["example.org##h1"],
        filterRulesUrl: "https://filters.adtidy.org/extension/chromium/filters/{filter_id}.txt",
        filtersMetadataUrl: "https://filters.adtidy.org/extension/chromium/filters.json",
    };

    const adguardApi = new AdguardApi();

    // console log request data on basic rule apply
    const onFilteringLogEvent = (event: FilteringLogEvent) => {
        if (event.type === FilteringEventType.APPLY_BASIC_RULE) {
            console.log(event.data);
        }
    };

    // console log current rules count, loaded in engine
    const logTotalCount = (): void => {
        console.log("Total rules count:", adguardApi.getRulesCount());
    };

    adguardApi.onFilteringLogEvent.subscribe(onFilteringLogEvent);

    await adguardApi.start(configuration);

    console.log("Finished Adguard API initialization.");
    logTotalCount();

    configuration.whitelist!.push("www.google.com");

    await adguardApi.configure(configuration);

    console.log("Finished Adguard API re-configuration");
    logTotalCount();

    // update config on assistant rule apply
    adguardApi.onAssistantCreateRule.subscribe(async (rule) => {
        console.log(`Rule ${rule} was created by Adguard Assistant`);
        configuration.rules!.push(rule);
        await adguardApi.configure(configuration);
        console.log("Finished Adguard API re-configuration");
        logTotalCount();
    });

    browser.runtime.onMessage.addListener(async (message) => {
        switch (message.type) {
            case "OPEN_ASSISTANT": {
                const activeTab = (await browser.tabs.query({ active: true }))[0];
                if (activeTab?.id) {
                    adguardApi.openAssistant(activeTab.id);
                }
                break;
            }
            default:
            // do nothing
        }
    });

    // Disable Adguard in 1 minute
    setTimeout(async () => {
        adguardApi.onFilteringLogEvent.unsubscribe(onFilteringLogEvent);
        await adguardApi.stop();
        console.log("Adguard API has been disabled.");
    }, 60 * 1000);
})();
