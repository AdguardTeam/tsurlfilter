import { Configuration, TsWebExtension } from '@adguard/tswebextension';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

export const addQunitListeners = (callbackName: string) => {
    let qUnit: any;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', (details: any) => {
                const name = document.getElementById('qunit-header')?.textContent;

                (<any>window)[callbackName](Object.assign(details, { name }))
            })
        },
        configurable: true,
    });
}

export const setTsWebExtensionConfig = async (
    defaultConfig: Configuration,
    rulesText: string
) => {
    await window.tsWebExtension.configure(Object.assign(defaultConfig, {
        filters: [{
            filterId: 1,
            content: rulesText
        }],
    }))
}