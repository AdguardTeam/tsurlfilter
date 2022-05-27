import { colorizeStatusText, colorizeTitleText } from './text-color';

export interface LogDetails {
    name: string,
    tests: {
        name: string,
        status: string,
    }[],
    status: string,
    testCounts: {
        passed: number,
        failed: number,
        skipped: number,
        total: number
    },
    runtime: number
}

export const logTestResult = (details: LogDetails) => {
    const counts = details.testCounts;

    console.log(colorizeTitleText(details.name));

    console.log('Status:', colorizeStatusText(details.status));
    console.log('Total %d tests: %d passed, %d failed, %d skipped',
        counts.total,
        counts.passed,
        counts.failed,
        counts.skipped,
    );
    console.log('Duration:', details.runtime, '\n');

    const tests = details.tests;

    for (let i = 0; i < tests.length; i++) {
        const test = tests[i];

        console.log(test.name, colorizeStatusText(test.status));
    }

    console.log('\n');
};
