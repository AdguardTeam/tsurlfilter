import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@typescript-eslint/parser';
import { parse as parseJsdoc } from 'comment-parser';

import type { Scriptlet, ScriptletParameter } from '../schema';

const ABP_SOURCE_DIR = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../downloads/abp-scriptlets/source',
);

/**
 * Extracts scriptlets from a single ABP source file.
 *
 * @param filePath - Path to the JavaScript file
 * @returns Array of extracted scriptlets
 */
async function extractFromFile(filePath: string): Promise<Scriptlet[]> {
    const code = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.js');
    const scriptletName = fileName;

    // Parse the JavaScript code
    const ast = parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        comment: true,
        loc: true,
        range: true,
    });

    const scriptlets: Scriptlet[] = [];

    // Find exported function declarations that match the file name
    // (to avoid extracting helper functions from the same file)
    for (const node of ast.body) {
        if (
            node.type === 'ExportNamedDeclaration'
            && node.declaration?.type === 'FunctionDeclaration'
            && node.declaration.id
        ) {
            const func = node.declaration;
            const funcName = func.id!.name;

            // Convert function name to kebab-case for comparison
            const funcNameKebab = funcName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

            // Only extract if function name matches or is very close to file name
            // This avoids extracting helper functions like setDebug, getDebugger, etc.
            if (funcNameKebab !== scriptletName && funcName !== scriptletName) {
                continue;
            }

            // Extract parameters from function signature
            const parameters: ScriptletParameter[] = [];

            for (const param of func.params) {
                if (param.type === 'Identifier') {
                    parameters.push({
                        name: param.name,
                        required: true,
                    });
                } else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
                    // Parameter has default value, so it's optional
                    let defaultValue: string | undefined;

                    if (param.right.type === 'Literal') {
                        defaultValue = param.right.value === null ? 'null' : String(param.right.value);
                    } else if (param.right.type === 'Identifier') {
                        defaultValue = param.right.name;
                    }

                    parameters.push({
                        name: param.left.name,
                        required: false,
                        defaultValue,
                    });
                } else if (param.type === 'RestElement' && param.argument.type === 'Identifier') {
                    // Rest parameter
                    parameters.push({
                        name: param.argument.name,
                        type: '...string',
                        required: false,
                    });
                }
            }

            // Extract JSDoc comment
            let jsdocComment: string | undefined;

            if (ast.comments) {
                // Find the JSDoc comment immediately before this function
                for (let i = ast.comments.length - 1; i >= 0; i -= 1) {
                    const comment = ast.comments[i];
                    if (
                        comment.type === 'Block'
                        && comment.value.startsWith('*')
                        && func.range
                        && comment.range
                        && comment.range[1] < func.range[0]
                    ) {
                        jsdocComment = `/*${comment.value}*/`;
                        break;
                    }
                }
            }

            let description: string | undefined;
            let since: string | undefined;
            const jsdocParams = new Map<string, { type?: string; description?: string }>();

            // Parse JSDoc if found
            if (jsdocComment) {
                const parsed = parseJsdoc(jsdocComment);

                if (parsed.length > 0) {
                    const block = parsed[0];

                    // Get description
                    if (block.description) {
                        description = block.description.trim();
                    }

                    // Process tags
                    for (const tag of block.tags) {
                        if (tag.tag === 'description') {
                            // comment-parser puts first word in 'name' field for @description tag
                            const parts = [tag.name, tag.description].filter(Boolean).join(' ');
                            description = parts.trim();
                        } else if (tag.tag === 'since') {
                            // Extract version number from "Adblock Plus X.Y.Z" or "Plus X.Y.Z"
                            const sinceText = tag.description.trim();
                            const versionMatch = sinceText.match(/(?:Adblock Plus|Plus)\s+([\d.]+)/);
                            since = versionMatch ? versionMatch[1] : sinceText;
                        } else if (tag.tag === 'param') {
                            jsdocParams.set(tag.name, {
                                type: tag.type,
                                description: tag.description.trim(),
                            });
                        }
                    }
                }
            }

            // Merge JSDoc parameter info with actual parameters
            for (const param of parameters) {
                const jsdocParam = jsdocParams.get(param.name);
                if (jsdocParam) {
                    if (jsdocParam.type && !param.type) {
                        // Remove leading ? from type since required field indicates optionality
                        param.type = jsdocParam.type.replace(/^\?/, '');
                    }
                    if (jsdocParam.description && !param.description) {
                        param.description = jsdocParam.description;
                    }
                }
            }

            scriptlets.push({
                name: scriptletName,
                context: ['main'],
                description,
                parameters,
                since,
            });
        }
    }

    return scriptlets;
}

/**
 * Recursively finds all .js files in a directory, excluding utils folders.
 *
 * @param dir - Directory to search
 * @returns Array of file paths
 */
async function findScriptletFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Skip utils folders
            if (entry.name !== 'utils') {
                const subFiles = await findScriptletFiles(fullPath);
                files.push(...subFiles);
            }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Extracts all ABP scriptlets from the source directory.
 *
 * @returns Array of all extracted ABP scriptlets
 */
export async function extractAbpScriptlets(): Promise<Scriptlet[]> {
    console.log('Extracting ABP scriptlets...');

    const files = await findScriptletFiles(ABP_SOURCE_DIR);
    const allScriptlets: Scriptlet[] = [];

    for (const file of files) {
        // console.log(`Processing: ${path.relative(ABP_SOURCE_DIR, file)}`);
        const scriptlets = await extractFromFile(file);
        allScriptlets.push(...scriptlets);
    }

    console.log(`Extracted ${allScriptlets.length} ABP scriptlets`);

    // Sort alphabetically by name
    allScriptlets.sort((a, b) => a.name.localeCompare(b.name));

    return allScriptlets;
}
