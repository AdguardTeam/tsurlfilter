import { promises as fs } from 'node:fs';

import * as acorn from 'acorn';
import path from 'path';
import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

// Mock crypto module to return predictable MD5 hashes
vi.mock('node:crypto', () => ({
    default: {
        createHash: () => ({
            update: () => ({
                digest: () => 'test-id',
            }),
        }),
    },
}));

import type { DomainConfig } from '../../../tasks/local-scripts';
import { extractJsRules, extractJsRulesWithDomains, formatRules } from '../../../tasks/local-scripts';

// Mock the Logger class with a shared instance
vi.mock('@adguard/logger', () => {
    // Create a shared mock instance that will be returned by all Logger constructors
    const mockInstance = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
    };

    const MockLogger = vi.fn(function () {
        return mockInstance;
    });

    // Attach the mock instance to the constructor for test access
    // @ts-expect-error - mockInstance is dynamically added for test access
    MockLogger.mockInstance = mockInstance;

    return { Logger: MockLogger };
});

// Import Logger to access the mock instance
const { Logger } = await import('@adguard/logger');
// @ts-expect-error - mockInstance is dynamically added in the mock factory
const mockLoggerInstance = Logger.mockInstance;

/**
 * Helper to validate JavaScript ES6 module syntax using Acorn parser.
 *
 * @param code The code to validate.
 */
const validateSyntax = (code: string): void => {
    expect(() => {
        acorn.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
        });
    }).not.toThrow();
};

describe('local-scripts', () => {
    describe('extractJsRules', () => {
        it('should extract js rule', async () => {
            const filterText = await fs.readFile(path.join(__dirname, 'filter-single-rule.txt'), 'utf-8');
            const expectedJsRulesStr = await fs.readFile(path.join(
                __dirname,
                'local-script-single-expected.js',
            ), 'utf-8');
            const jsRulesStr = await formatRules(extractJsRules(filterText));

            expect(jsRulesStr).toBe(expectedJsRulesStr);
            // Verify the generated code is valid ES6 module syntax
            validateSyntax(jsRulesStr);
        });

        it('should extract multiple js rules', async () => {
            const filterText = await fs.readFile(path.join(__dirname, 'filter-multiple-rules.txt'), 'utf-8');
            const expectedJsRulesStr = await fs.readFile(path.join(
                __dirname,
                'local-script-multiple-expected.js',
            ), 'utf-8');
            const jsRulesStr = await formatRules(extractJsRules(filterText));

            expect(jsRulesStr).toBe(expectedJsRulesStr);
            // Verify the generated code is valid ES6 module syntax
            validateSyntax(jsRulesStr);
        });

        it('should skip invalid js rules and only include valid ones', async () => {
            const filterText = await fs.readFile(path.join(__dirname, 'filter-invalid-rules.txt'), 'utf-8');
            const expectedJsRulesStr = await fs.readFile(path.join(
                __dirname,
                'local-script-invalid-expected.js',
            ), 'utf-8');
            const jsRulesStr = await formatRules(extractJsRules(filterText));
            expect(jsRulesStr).toBe(expectedJsRulesStr);
            // Verify the generated code is valid ES6 module syntax
            validateSyntax(jsRulesStr);
            // Verify logger.error was called for the invalid rule
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                expect.stringContaining('Error parsing script rule: example.org#%#invalid syntax {{{'),
                expect.any(Error),
            );
        });

        it('should exclude scriptlets and only extract JS injection rules', async () => {
            const filterText = await fs.readFile(path.join(__dirname, 'filter-with-scriptlet.txt'), 'utf-8');
            const expectedJsRulesStr = await fs.readFile(path.join(
                __dirname,
                'local-script-scriptlet-expected.js',
            ), 'utf-8');
            const jsRulesStr = await formatRules(extractJsRules(filterText));

            expect(jsRulesStr).toBe(expectedJsRulesStr);
            // Verify the generated code is valid ES6 module syntax
            validateSyntax(jsRulesStr);
        });
    });

    describe('extractJsRulesWithDomains', () => {
        it('should extract js rules with domain information', async () => {
            const filterText = await fs.readFile(path.join(__dirname, 'filter-with-domains.txt'), 'utf-8');
            const expectedJsonStr = await fs.readFile(path.join(
                __dirname,
                'local-script-domains-expected.json',
            ), 'utf-8');

            // Extract rules with domains
            const rulesMap = extractJsRulesWithDomains(filterText);

            // Convert Map to object structure for comparison
            const actualRules: Record<string, DomainConfig[]> = {};
            rulesMap.forEach((configs, scriptBody) => {
                actualRules[scriptBody] = configs;
            });

            const expected = JSON.parse(expectedJsonStr);

            expect(actualRules).toEqual(expected.rules);
        });
    });
});
