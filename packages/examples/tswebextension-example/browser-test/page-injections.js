exports.getTestcasesData = () => {
    const testInfocontainers = document.querySelectorAll('div.test-info');

    const testcases = [];

    for (let testInfocontainer of testInfocontainers) {
        const compatibility = testInfocontainer.querySelector('div.full-compatibility').textContent;

        if (compatibility.indexOf('Chrome') < 0) {
            continue;
        }
        const testTitleElement = testInfocontainer.querySelector('a.test-title');

        const title = testTitleElement.textContent;
        const pageUrl = '/' + testTitleElement.getAttribute('href');

        const rulesUrl = pageUrl.slice(0, pageUrl.lastIndexOf('.html')) + '.txt';

        testcases.push({
            title,
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

            console.log(qUnit);

            // https://github.com/js-reporters/js-reporters
            qUnit.on('runEnd', details => {
                window[callbackName](details)
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