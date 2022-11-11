import fs from 'fs';

import { DeclarativeRule, DeclarativeFilterConverter, Filter } from '../src/rules/declarative-converter';

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

const convertTxtToRules = async (
    rules: string[],
): Promise<DeclarativeRule[]> => {
    const filter = new Filter(
        0,
        { getContent: () => Promise.resolve(rules) },
    );

    try {
        const { ruleSets: [ruleSet] } = await filterConverter.convertToSingle(
            [filter],
            { resourcesPath: '/path/to/resources' },
        );

        const { declarativeRules } = await ruleSet.serialize();

        return declarativeRules;
    } catch (e) {
        console.error('ERROR during conversion: ');
        throw e;
    }
};

// '# Description' -> ['1. [Description](#description)', '<a name="description"></a>']
const parseRowAndLinkFromText = (txt: string): [string, string] | null => {
    if (!txt.startsWith('#')) {
        return null;
    }

    // Gen table of contents line
    let index = 0;
    while (txt[index] === '#' && index < txt.length - 1) {
        index += 1;
    }
    const indentLeft = '    '.repeat(index - 1);

    // Gen link
    const linkName = txt.slice(index).trim().toLocaleLowerCase().replace(/\s/g, '_');
    const htmlLink = `<a name="${linkName}"></a>`;

    return [
        `${indentLeft}1. [${txt.slice(index).trim()}](#${linkName})`,
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
            const parsedRowAndLinkFromText = parseRowAndLinkFromText(text);
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
