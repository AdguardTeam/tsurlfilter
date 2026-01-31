import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { parse } from 'acorn';
import { copy } from 'fs-extra';
import process from 'process';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { LocalScriptRulesJs } from '../../../src/common/local-script-rules-js';
import { LocalScriptRulesJson } from '../../../src/common/local-script-rules-json';
import { AssetsLoader } from '../../../src/lib/assets/loader';

vi.mock('path', { spy: true });
vi.mock('process', { spy: true });
vi.mock('fs-extra');

describe('load', () => {
    const dest = 'dest';
    const src = 'src';
    const to = 'to';
    const filtersRelativePath = '../filters/chromium-mv3';

    const mockResolve = vi.mocked(path.resolve);
    const mockCopy = vi.mocked(copy);
    const cwdSpy = vi.spyOn(process, 'cwd');

    beforeEach(() => {
        // Vitest 4: Clear automock call history before each test
        vi.clearAllMocks();
        // Re-apply spy mock after clearing
        cwdSpy.mockReturnValue('cwd');
        mockResolve
            .mockReturnValueOnce(to)
            .mockReturnValueOnce(src);
    });

    it('should load assets', async () => {
        const loader = new AssetsLoader();

        await expect(loader.load(dest)).resolves.toBeUndefined();

        expect(mockResolve).toHaveBeenCalledTimes(2);
        expect(cwdSpy).toHaveBeenCalledTimes(1);
        expect(mockResolve).toHaveBeenCalledWith('cwd', dest);
        expect(mockResolve).toHaveBeenCalledWith(expect.any(String), filtersRelativePath);
        expect(mockCopy).toHaveBeenCalledTimes(1);
        expect(mockCopy).toHaveBeenCalledWith(src, to);
    });

    it('should throw an error if assets cannot be loaded', async () => {
        mockCopy.mockImplementationOnce(() => {
            throw new Error();
        });

        const loader = new AssetsLoader();

        await expect(loader.load(dest)).rejects.toThrow();

        expect(mockResolve).toHaveBeenCalledTimes(2);
        expect(cwdSpy).toHaveBeenCalledTimes(1);
        expect(mockResolve).toHaveBeenCalledWith('cwd', dest);
        expect(mockResolve).toHaveBeenCalledWith(expect.any(String), filtersRelativePath);
        expect(mockCopy).toHaveBeenCalledTimes(1);
        expect(mockCopy).toHaveBeenCalledWith(src, to);
    });
});

describe('extendLocalScriptRulesJs', () => {
    let tempDir: string;
    let testFilePath: string;
    let loader: AssetsLoader;

    beforeEach(async () => {
        // Create a temporary directory for test files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loader-test-js-'));
        testFilePath = path.join(tempDir, LocalScriptRulesJs.FILENAME);
        loader = new AssetsLoader();
    });

    afterEach(async () => {
        // Clean up temporary files
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should extend existing rules with new JS rules', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("existing");']);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with new rule
        const customRules = ['example.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file contains both rules
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');

        // Check that both rules are present in the file
        expect(updatedContent).toContain('console.log("existing");');
        expect(updatedContent).toContain('console.log("new");');
    });

    it('should handle empty custom rules array', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("existing");']);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with empty array
        const customRules: string[] = [];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should handle custom rules with no JS injection rules', async () => {
        // Create initial file with one rule
        const initialRules = new Set(['console.log("existing");']);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with rules that are not JS injection rules
        const customRules = [
            'example.com##.ad',
            '||example.com^',
            'example.com##+js(scriptlet, arg)',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should skip invalid JS rules and keep valid ones', async () => {
        // Create initial file
        const initialRules = new Set(['console.log("existing");']);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with mix of valid and invalid rules
        const customRules = [
            'example.com#%#console.log("valid");',
            'example.com#%#invalid syntax {{{',
            'example.com#%#alert("another valid");',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify only valid rules were added
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');

        // Check all valid rules are present
        expect(updatedContent).toContain('console.log("existing");');
        expect(updatedContent).toContain('console.log("valid");');
        expect(updatedContent).toContain('alert("another valid");');
    });

    it('should handle multiple new rules', async () => {
        // Create initial file
        const initialRules = new Set(['console.log("existing");']);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with multiple rules
        const customRules = [
            'example.com#%#console.log("rule1");',
            'test.com#%#console.log("rule2");',
            'site.org#%#alert("rule3");',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify all rules were added
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');

        // Check all rules are present
        expect(updatedContent).toContain('console.log("existing");');
        expect(updatedContent).toContain('console.log("rule1");');
        expect(updatedContent).toContain('console.log("rule2");');
        expect(updatedContent).toContain('alert("rule3");');
    });

    it('should preserve existing rules with special characters when extending', async () => {
        // Create initial file with rules containing special characters like quotes and backslashes
        // NOTE: terser will normalize formatting (e.g., " -> ', whitespace), but rules are preserved
        const initialRules = new Set([
            'console.log("test with \\"quotes\\"");',
            'console.log("backslash: \\\\");',
            'console.log("newline: \\n");',
        ]);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with new custom rules
        const customRules = [
            'example.com#%#console.log("new custom rule");',
            'test.com#%#alert("another custom rule");',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify all rules are present
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');

        // Check that all rules are present in the file (special characters are preserved)
        expect(updatedContent).toContain('test with');
        expect(updatedContent).toContain('quotes');
        expect(updatedContent).toContain('backslash');
        expect(updatedContent).toContain('newline');
        expect(updatedContent).toContain('new custom rule');
        expect(updatedContent).toContain('another custom rule');

        // Verify the file is valid JavaScript
        expect(() => parse(updatedContent, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow();
    });

    it('should not lose rules during extend', async () => {
        // This test verifies that extending preserves all existing rules

        const initialRules = new Set([
            'var x = /[sS]+/;',
            'window.test = true;',
        ]);

        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with a new rule
        const customRules = ['example.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify existing rules were preserved (not lost)
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');

        // Check all rules are present
        expect(updatedContent).toContain('var x');
        expect(updatedContent).toContain('window.test');
        expect(updatedContent).toContain('console.log("new");');
    });

    it('should support placeholder-based extension', async () => {
        const initialRules = new Set(['console.log("existing");']);

        // Serialize with placeholder
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);

        // Verify placeholder exists in the file (Terser removes quotes from valid identifiers)
        expect(initialContent).toContain('__PLACEHOLDER__: () => {}');

        // Extend with new rules using the static method
        const customRules = ['example.com#%#console.log("new");'];
        const extendedContent = await LocalScriptRulesJs.extend(initialContent, customRules);

        // Verify the new rule was inserted
        expect(extendedContent).toContain('console.log("new");');

        // Verify the old rule was preserved
        expect(extendedContent).toContain('console.log("existing");');
    });

    it('should NOT deduplicate rules with scripts differing only by whitespace', async () => {
        // This test verifies that rules differing only by whitespace (e.g., '{}' vs '{ }')
        // are preserved as separate entries and NOT deduplicated.

        // Test parsing rules that differ only by whitespace
        const rules1 = LocalScriptRulesJs.parse([
            'example.com#%#function test(){}',
            'example.com#%#function test(){ }',
        ]);

        // Both rules should be kept separate (NOT deduplicated)
        expect(rules1.size).toBe(2);
        expect(rules1.has('function test(){}')).toBe(true);
        expect(rules1.has('function test(){ }')).toBe(true);

        const rules2 = LocalScriptRulesJs.parse([
            'example.com#%#var x=1;',
            'example.com#%#var x = 1;',
        ]);

        // Similarly, these two should also be kept separate
        expect(rules2.size).toBe(2);
        expect(rules2.has('var x=1;')).toBe(true);
        expect(rules2.has('var x = 1;')).toBe(true);

        // Now test the full flow with serialization and extension
        const initialRules = new Set([
            'function test(){}',
            'function test(){ }',
        ]);
        const initialContent = await LocalScriptRulesJs.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with more rules that differ only by whitespace
        const customRules = [
            'example.com#%#var x=1;',
            'example.com#%#var x = 1;',
        ];
        await loader.extendLocalScriptRulesJs(testFilePath, customRules);

        // Verify the file contains all 4 rules (none were deduplicated)
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');

        // Parse the output file and count properties in the localScriptRules object
        // Using acorn to parse and navigate the AST to count rule entries
        const ast = parse(updatedContent, { ecmaVersion: 'latest', sourceType: 'module' });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exportDeclaration = ast.body[0] as any;
        const variableDeclarator = exportDeclaration.declaration.declarations[0];
        const localScriptRulesObject = variableDeclarator.init;
        const totalProperties = localScriptRulesObject.properties.length;

        // Expect 4 rules + 1 placeholder marker
        expect(totalProperties).toBe(5);

        // Verify that all variants with exact whitespace are present
        expect(updatedContent).toContain('function test(){}');
        expect(updatedContent).toContain('function test(){ }');
        expect(updatedContent).toContain('var x=1;');
        expect(updatedContent).toContain('var x = 1;');

        // Verify the file is valid JavaScript
        expect(() => parse(updatedContent, { ecmaVersion: 'latest', sourceType: 'module' })).not.toThrow();
    });
});

describe('extendLocalScriptRulesJson', () => {
    let tempDir: string;
    let testFilePath: string;
    let loader: AssetsLoader;

    beforeEach(async () => {
        // Create a temporary directory for test files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'loader-test-json-'));
        testFilePath = path.join(tempDir, LocalScriptRulesJson.FILENAME);
        loader = new AssetsLoader();
    });

    afterEach(async () => {
        // Clean up temporary files
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should extend existing rules with new JS rules and domain configs', async () => {
        // Create initial file with one rule
        const initialRules = new Map([
            ['console.log("existing");', [{ permittedDomains: ['example.com'], restrictedDomains: [] }]],
        ]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with new rule
        const customRules = ['test.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file contains both rules
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = LocalScriptRulesJson.deserialize(updatedContent);

        expect(updatedRules.size).toBe(2);
        expect(updatedRules.has('console.log("existing");')).toBe(true);
        expect(updatedRules.has('console.log("new");')).toBe(true);

        const newRuleConfigs = updatedRules.get('console.log("new");');
        expect(newRuleConfigs).toBeDefined();
        expect(newRuleConfigs).toHaveLength(1);
        expect(newRuleConfigs![0].permittedDomains).toContain('test.com');
    });

    it('should merge domain configs for the same script body', async () => {
        // Create initial file with one rule
        const initialRules = new Map([[
            'console.log("test");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with the same script body but different domain
        const customRules = ['test.com#%#console.log("test");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file contains one rule with two domain configs
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = LocalScriptRulesJson.deserialize(updatedContent);

        expect(updatedRules.size).toBe(1);
        const configs = updatedRules.get('console.log("test");');
        expect(configs).toBeDefined();
        expect(configs).toHaveLength(2);
        expect(configs![0].permittedDomains).toContain('example.com');
        expect(configs![1].permittedDomains).toContain('test.com');
    });

    it('should not duplicate domain configs', async () => {
        // Create initial file with one rule
        const initialRules = new Map([[
            'console.log("test");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with the same rule and domain
        const customRules = ['example.com#%#console.log("test");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file still contains only one domain config
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = LocalScriptRulesJson.deserialize(updatedContent);

        expect(updatedRules.size).toBe(1);
        const configs = updatedRules.get('console.log("test");');
        expect(configs).toBeDefined();
        expect(configs).toHaveLength(1);
    });

    it('should handle rules with restricted domains', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with rule that has restricted domain
        const customRules = ['example.com,~sub.example.com#%#console.log("new");'];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the domain config is correct
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = LocalScriptRulesJson.deserialize(updatedContent);

        const newRuleConfigs = updatedRules.get('console.log("new");');
        expect(newRuleConfigs).toBeDefined();
        expect(newRuleConfigs).toHaveLength(1);
        expect(newRuleConfigs![0].permittedDomains).toContain('example.com');
        expect(newRuleConfigs![0].restrictedDomains).toContain('sub.example.com');
    });

    it('should handle empty custom rules array', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with empty array
        const customRules: string[] = [];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should handle custom rules with no JS injection rules', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with non-JS rules
        const customRules = [
            'example.com##.ad',
            '||example.com^',
            'example.com##+js(scriptlet, arg)',
        ];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify the file is unchanged
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        expect(updatedContent).toBe(initialContent);
    });

    it('should handle multiple rules with different domains', async () => {
        // Create initial file
        const initialRules = new Map([[
            'console.log("existing");',
            [{ permittedDomains: ['example.com'], restrictedDomains: [] }],
        ]]);
        const initialContent = LocalScriptRulesJson.serialize(initialRules);
        await fs.writeFile(testFilePath, initialContent);

        // Extend with multiple rules
        const customRules = [
            'test.com#%#console.log("rule1");',
            'site.org,another.org#%#console.log("rule2");',
            'example.com,~sub.example.com#%#alert("rule3");',
        ];
        await loader.extendLocalScriptRulesJson(testFilePath, customRules);

        // Verify all rules were added with correct domain configs
        const updatedContent = await fs.readFile(testFilePath, 'utf-8');
        const updatedRules = LocalScriptRulesJson.deserialize(updatedContent);

        expect(updatedRules.size).toBe(4);

        const rule2Configs = updatedRules.get('console.log("rule2");');
        expect(rule2Configs).toBeDefined();
        expect(rule2Configs![0].permittedDomains).toHaveLength(2);
        expect(rule2Configs![0].permittedDomains).toContain('site.org');
        expect(rule2Configs![0].permittedDomains).toContain('another.org');
    });
});
