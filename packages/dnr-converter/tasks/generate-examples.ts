import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type DeclarativeRule } from '../src/declarative-rule';
import { Filter, FilterConverter } from '../src/index';
import { re2Validator } from '../src/re2-regexp/re2-validator';
import { regexValidatorNode } from '../src/re2-regexp/regex-validator-node';

// Docs run in Node, not an extension. Use the same RE2 validator as the CLI so
// regex examples match real Node conversion output.
re2Validator.setValidator(regexValidatorNode);

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readmeTxtPath = path.resolve(__dirname, '../src/examples/readme.txt');
const readmeMdPath = path.resolve(__dirname, '../src/examples/README.md');

const outputTemplate = (
    txtRules: string[],
    convertedRules: DeclarativeRule[],
    errors: string[],
): string[] => {
    const codeBlock = '```';
    let template = `
${codeBlock}adblock
${txtRules.join('\n')}
${codeBlock}

↓↓↓↓ converted to ↓↓↓↓

${codeBlock}json
${JSON.stringify(convertedRules, null, 2)}
${codeBlock}`;

    if (errors.length > 0) {
        template += `\n\n> ⚠️ Conversion errors: ${errors.join(', ')}`;
    }

    return template.split('\n');
};

const readFileByLines = (filePath: string): string[] => {
    const fileData = fs.readFileSync(filePath, { encoding: 'utf-8' });
    return fileData.split('\n');
};

/**
 * Finds nearest parent row in the table of contents.
 *
 * @param tableOfContents The table of contents as an array of strings.
 * @param indentLeft The indentation string to match parent rows.
 *
 * @returns The link to the nearest parent row.
 */
const findParentLink = (tableOfContents: string[], indentLeft: string): string => {
    const parentRow = tableOfContents
        .slice()
        .reverse()
        .find((item) => !item.startsWith(indentLeft));

    if (!parentRow) {
        return '';
    }

    const linkPosStart = parentRow.indexOf('(#') + 2;
    const linkPosEnd = parentRow.indexOf(')');

    return parentRow.slice(linkPosStart, linkPosEnd);
};

/**
 * From provided line of text generate one row to the table of contents
 * and id for link.
 *
 * @param txt The text to be parsed.
 * @param tableOfContents The table of contents as an array of strings.
 *
 * @returns The row for the table of contents and the link to the text, or null.
 */
const parseRowAndLinkFromText = (
    txt: string,
    tableOfContents: string[],
): [string, string] | null => {
    if (!txt.startsWith('#')) {
        return null;
    }

    let levelInTable = 0;
    while (txt[levelInTable] === '#' && levelInTable < txt.length - 1) {
        levelInTable += 1;
    }
    const indentLeft = '    '.repeat(levelInTable - 1);

    let parentLink = '';
    if (levelInTable > 1) {
        parentLink = findParentLink(tableOfContents, indentLeft);
    }
    const hash = parentLink ? `${parentLink}__` : '';

    const linkName = txt
        .slice(levelInTable)
        .trim()
        .toLowerCase()
        .replace(/[\s,]/g, '_');

    const idLinkWithHash = `${hash}${linkName}`;
    const htmlLink = `<a name="${idLinkWithHash}"></a>`;

    return [
        `${indentLeft}1. [${txt.slice(levelInTable).trim()}](#${idLinkWithHash})`,
        htmlLink,
    ];
};

/**
 * Converts provided text rules to Declarative rules using FilterConverter.
 *
 * @param rules Text rules to convert.
 *
 * @returns Object with declarative rules and error messages.
 */
const convertTxtToRules = async (
    rules: string[],
): Promise<{ declarativeRules: DeclarativeRule[]; errors: string[] }> => {
    const filter = new Filter(0, rules.join('\n'));
    const converter = new FilterConverter();

    try {
        const [{ ruleset, errors }] = await converter.convert(
            [filter],
            { resourcesPath: '/path/to/resources' },
        );

        const declarativeRules = ruleset.getDeclarativeRules();
        const errorMessages = errors.map((e) => e.message);

        return { declarativeRules, errors: errorMessages };
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('ERROR during conversion: ', e);
        return { declarativeRules: [], errors: [(e as Error).message] };
    }
};

const parseTxt = async (filePath: string): Promise<string[]> => {
    const lines = readFileByLines(filePath);

    const output: string[] = [];
    const tableOfContents: string[] = ['# Table of contents'];
    const commentTextStartPos = 2;

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('!')) {
            const text = lines[i].slice(commentTextStartPos);
            const parsedRowAndLinkFromText = parseRowAndLinkFromText(text, tableOfContents);
            if (parsedRowAndLinkFromText) {
                const [row, link] = parsedRowAndLinkFromText;
                tableOfContents.push(row);
                output.push(link);
                output.push(text);
            } else {
                output.push(text);
            }
            continue;
        }

        const rulesText: string[] = [];
        while (i < lines.length && lines[i] && !lines[i].startsWith('!')) {
            rulesText.push(lines[i]);
            // eslint-disable-next-line no-plusplus
            i++;
        }

        if (rulesText.length > 0) {
            // eslint-disable-next-line no-await-in-loop
            const { declarativeRules, errors } = await convertTxtToRules(rulesText);
            const convertedExample = outputTemplate(rulesText, declarativeRules, errors);
            output.push(...convertedExample);
        }

        // If the beginning of a comment is found, roll back one line
        if (i < lines.length && lines[i]?.startsWith('!')) {
            i -= 1;
            continue;
        }
    }

    return tableOfContents.concat(output);
};

const generate = async (): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log('Generating examples documentation...');
    const output = await parseTxt(readmeTxtPath);
    const next = `${output.join('\n')}\n`;

    // Skip the write when content is unchanged so CI's mtime-based freshness
    // check (`find … -newer`) does not treat a no-op regenerate as "stale".
    const previous = fs.existsSync(readmeMdPath)
        ? fs.readFileSync(readmeMdPath, { encoding: 'utf-8' })
        : null;

    if (previous === next) {
        // eslint-disable-next-line no-console
        console.log(`Unchanged: ${readmeMdPath}`);
        return;
    }

    fs.writeFileSync(readmeMdPath, next, { encoding: 'utf-8' });
    // eslint-disable-next-line no-console
    console.log(`Written to ${readmeMdPath}`);
};

generate().catch((err: unknown) => {
    throw err;
});
