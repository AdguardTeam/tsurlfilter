import { FilterListPreprocessor } from '@adguard/tsurlfilter';
import {
    type Configuration,
    type TsWebExtension,
} from '@adguard/tswebextension/mv3';
import { LogDetails } from './logger';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
        isInitialized: boolean;
    }
}

export const addQunitListeners = (logResultFnName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qUnit: any;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', (details: LogDetails) => {
                const name = document.getElementById('qunit-header')?.textContent;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (<any>window)[logResultFnName](Object.assign(details, { name }));

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (<any>window).testsCompleted = true;
            });
        },
        configurable: true,
    });
};

export type SetTsWebExtensionConfigArg = [ defaultConfig: Configuration, userrules: string ];

export const setTsWebExtensionConfig = async (arg: SetTsWebExtensionConfigArg) => {
    const [ defaultConfig, userrules ] = arg;
    const configuration: Configuration = defaultConfig;
    const preprocessed = FilterListPreprocessor.preprocess(userrules);
    configuration.userrules = {
        content: preprocessed.filterList,
        sourceMap: preprocessed.sourceMap,
        conversionMap: preprocessed.conversionMap,
        rawFilterList: preprocessed.rawFilterList,
        trusted: true,
    };
    await self.tsWebExtension.configure(configuration);
};

export const waitUntilExtensionInitialized = async (eventName: string): Promise<void> => {
    return new Promise((resolve: () => void) => {
        addEventListener(eventName, resolve, { once: true });
    });
};

export const waitUntilTestsCompleted = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>window).testsCompleted;
};
