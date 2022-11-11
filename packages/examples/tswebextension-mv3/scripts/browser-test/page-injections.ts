import { Configuration, TsWebExtension } from '@adguard/tswebextension/mv3';
import { LogDetails } from './logger';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
        isInitialized: boolean;
    }
}

export const addQunitListeners = (logResultFnName: string) => {
    let qUnit: any;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', (details: LogDetails) => {
                const name = document.getElementById('qunit-header')?.textContent;

                (<any>window)[logResultFnName](Object.assign(details, { name }));

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
    configuration.userrules = userrules.split('\n');
    await self.tsWebExtension.configure(configuration);
};

export const waitUntilExtensionInitialized = async (eventName: string): Promise<void> => {
    return new Promise((resolve: () => void) => {
        addEventListener(eventName, resolve, { once: true });
    });
};

export const waitUntilTestsCompleted = () => {
    return (<any>window).testsCompleted;
};
