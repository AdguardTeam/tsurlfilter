import fs from 'fs';

import { type DeclarativeRule, DeclarativeFilterConverter, Filter } from '../src/rules/declarative-converter';

const readmeTxtPath = './src/rules/declarative-converter/readme.txt';
const readmeMdPath = './src/rules/declarative-converter/README.md';

const filterConverter = new DeclarativeFilterConverter();

const outputTemplate = (
    txtRules: string[],
    convertedRules: DeclarativeRule[],
): string[] => {
    const codeBlock = '```';
    const template = `
${codeBlock}adblock
${txtRules.join('\n')}
${codeBlock}

↓↓↓↓ converted to ↓↓↓↓

${codeBlock}json
${JSON.stringify(convertedRules, undefined, '\t')}

${codeBlock}`;

    return template.split('\n');
};

const readFileByLines = (filePath: string) => {
    const fileData = fs.readFileSync(filePath, { encoding: 'utf-8' });
    return fileData.split('\n');
};

/**
 * Finds nearest parent row in the table of contents
 */
const findParentLink = (tableOfContents: string[], indentLeft: string) => {
    const parentRow = tableOfContents
        .slice()
        .reverse()
        .find((item) => {
            return !item.startsWith(indentLeft);
        });

    if (!parentRow) {
        return '';
    }

    const linkPosStart = parentRow.indexOf('(#') + 2;
    const linkPosEnd = parentRow.indexOf(')\r?\n');

    return parentRow.slice(linkPosStart, linkPosEnd);
};

/**
 * Converts provided bunch of text rules to Declarative rules
 */
const convertTxtToRules = async (
    rules: string[],
): Promise<DeclarativeRule[]> => {
    const filter = new Filter(
        0,
        { getContent: async () => rules },
    );

    try {
        const { ruleSet } = await filterConverter.convertDynamicRuleSets(
            [filter],
            [],
            { resourcesPath: '/path/to/resources' },
        );

        const declarativeRules = await ruleSet.getDeclarativeRules();

        return declarativeRules;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('ERROR during conversion: ');
        throw e;
    }
};

/**
 * From provided line of text generate one row to the table of contents
 * and id for link, e.g.:
 * '# Description' -> ['1. [Description](#description)', '<a name="description"></a>']
 */
const parseRowAndLinkFromText = (
    txt: string,
    tableOfContents: string[],
): [string, string] | null => {
    if (!txt.startsWith('#')) {
        return null;
    }

    // Gen table of contents line
    let levelInTable = 0;
    while (txt[levelInTable] === '#' && levelInTable < txt.length - 1) {
        levelInTable += 1;
    }
    const indentLeft = '    '.repeat(levelInTable - 1);

    let parentLink = '';
    if (levelInTable > 1) {
        parentLink = findParentLink(tableOfContents, indentLeft);
    }
    // To avoid duplication of links
    const hash = parentLink ? `${parentLink}__` : '';

    // Gen link
    const linkName = txt
        .slice(levelInTable)
        .trim()
        .toLocaleLowerCase()
        .replace(/[\s,]/g, '_');

    const idLinkWithHash = `${hash}${linkName}`;
    const htmlLink = `<a name="${idLinkWithHash}"></a>`;

    return [
        `${indentLeft}1. [${txt.slice(levelInTable).trim()}](#${idLinkWithHash})`,
        htmlLink,
    ];
};

const parseTxt = async (filePath: string) => {
    const lines = readFileByLines(filePath);

    const output: string[] = [];
    const tableOfContents: string[] = [
        '# Table of contents',
    ];
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
            const convertedRules = await convertTxtToRules(rulesText);
            const convertedExample = outputTemplate(rulesText, convertedRules);
            output.push(...convertedExample);
        }

        // If the beginning of a comment is found, roll back one line
        if (lines[i].startsWith('!')) {
            i -= 1;
            continue;
        }
    }

    return tableOfContents.concat(output);
};

const generate = async () => {
    const output = await parseTxt(readmeTxtPath);

    fs.writeFileSync(readmeMdPath, output.join('\n'), { encoding: 'utf-8' });
};

generate();
