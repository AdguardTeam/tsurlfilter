const { colorizeStatusText } = require("./text-color"); 

exports.logTestResult = (details) => {
    const counts = details.testCounts;

    console.log('Name:', details.name)

    console.log('Status:', colorizeStatusText(details.status));
    console.log('Total %d tests: %d passed, %d failed, %d skipped',
        counts.total,
        counts.passed,
        counts.failed,
        counts.skipped
    );
    console.log('Duration:', details.runtime, '\n');

    const tests = details.tests;

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];

        console.log(test.name, colorizeStatusText(test.status));
    }

    console.log('\n');
}