import { Configuration, TsWebExtension } from '@adguard/tswebextension';

declare global {
    interface Window {
        tsWebExtension: TsWebExtension;
    }
}

export const getTestcasesData = () => {
    const testInfocontainers = document.querySelectorAll('div.test-info');

    const testcases = [];

    for (let testInfocontainer of testInfocontainers) {
        const compatibility = testInfocontainer.querySelector('div.full-compatibility').textContent;

        if (compatibility.indexOf('Chrome') < 0) {
            continue;
        }
        const testTitleElement = testInfocontainer.querySelector('a.test-title');

        const pageUrl = '/' + testTitleElement.getAttribute('href');

        const rulesUrl = pageUrl.slice(0, pageUrl.lastIndexOf('.html')) + '.txt';

        testcases.push({
            pageUrl,
            rulesUrl,
        })
    }

    return testcases;
}

export const addQunitListeners = (callbackName: string) => {
    let qUnit: QUnit;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', details => {
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