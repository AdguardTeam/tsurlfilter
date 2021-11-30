exports.getTestcasesData = () => {
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

exports.addQunitListeners = (callbackName) => {
    let qUnit;

    Object.defineProperty(window, 'QUnit', {
        get: () => qUnit,
        set: (value) => {
            qUnit = value;

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', details => {
                const name = document.getElementById('qunit-header')?.textContent;

                window[callbackName]({...details, name })
            })
        },
        configurable: true,
    });
}

exports.setTsWebExtensionConfig = async (defaultConfig, rulesText) => {
    await window.tsWebExtension.configure({
        ...defaultConfig,
        filters: [{
            filterId: 1,
            content: rulesText
        }],
    })
}