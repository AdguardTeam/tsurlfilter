#!/usr/bin/env node
/**
 * @file Finalizes a keep-a-changelog CHANGELOG.md for a release:
 *   1. Empties the [Unreleased] section, keeping the standard subsection
 *      template (Added/Changed/Deprecated/Removed/Fixed/Security).
 *   2. Moves the previously-unreleased entries under a new
 *      `## [<version>] - <YYYY-MM-DD>` heading, dropping empty subsections.
 *   3. Appends the new section to $GITHUB_OUTPUT as `release_notes`
 *      (multiline output syntax).
 *   4. When link-reference definitions are present, emits a `[<version>]: ...`
 *      definition for the new version heading in the style the file already
 *      uses: `.../releases/tag/<pkg>-v<version>` when the changelog uses
 *      per-version `releases/tag` references (all packages), or the
 *      `.../compare/<old>...<new>` form when it uses the compare style (kept
 *      so the `[Unreleased]` compare-chain stays intact).
 *   5. A tsurlfilter-style `[Unreleased]: .../compare/<old>...HEAD` line is
 *      re-pointed at the new tag and emitted inside the fresh `[Unreleased]`
 *      block (where it originally sat), so the previously-unreleased entries
 *      keep resolving after the rewrite, matching every existing entry — and
 *      so the next finalize re-collects it from the Unreleased block and
 *      re-points it again instead of stranding a stale copy in a released
 *      section.
 *
 * Environment:
 *   CHANGELOG_PATH - path to the changelog file.
 *   NEW_VERSION    - version being released (e.g. 4.2.0, 4.2.0-beta.1).
 *   GITHUB_OUTPUT  - step output file provided by the runner.
 */

import fs from 'node:fs';
import process from 'node:process';

const fail = (message) => {
    console.error(`::error::${message}`);
    process.exit(1);
};

const changelogPath = process.env.CHANGELOG_PATH;
const newVersion = process.env.NEW_VERSION;
// FINALIZE_DATE (YYYY-MM-DD) overrides "today" so tests are deterministic and
// a UTC-midnight boundary between cases cannot flip the produced date.
const today = process.env.FINALIZE_DATE || new Date().toISOString().slice(0, 10);

if (!/^\d+\.\d+\.\d+(-[a-z]+\.[0-9]+)?$/.test(newVersion || '')) {
    fail(`Invalid NEW_VERSION '${newVersion}'. Expected: <M>.<m>.<p>[-<channel>.<N>]`);
}
if (!changelogPath || !fs.existsSync(changelogPath)) {
    fail(`CHANGELOG_PATH '${changelogPath}' does not exist`);
}
if (!process.env.GITHUB_OUTPUT) {
    // Validate up front so a missing runner output file never leaves a mutated
    // changelog behind (previously the rewrite happened first and only then a
    // TypeError fired on the dereference).
    fail('GITHUB_OUTPUT is not set; refusing to rewrite the changelog');
}

const content = fs.readFileSync(changelogPath, 'utf8');

// Escape regex-special characters in the version (dots, hyphens) so a version
// like 4.2.0-beta.1 can never broaden the match.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Re-release guard: never create a second (empty) heading for an already
// released version — the publish parse would otherwise read the wrong/empty
// section.
if (new RegExp(`^## \\[${escapeRegex(newVersion)}\\](?:\\s+-\\s+[0-9]{4}-[0-9]{2}-[0-9]{2})?[ \\t]*$`, 'm').test(content)) {
    fail(`Version ${newVersion} is already present as a heading in ${changelogPath}; refusing to create a duplicate`);
}

const lines = content.split(/\r?\n/);

const result = [];
let i = 0;
let foundUnreleased = false;

while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '## [Unreleased]') {
        foundUnreleased = true;

        // Reset the Unreleased section and open the new version below it.
        result.push('## [Unreleased]');
        result.push('');
        result.push('### Added');
        result.push('');
        result.push('### Changed');
        result.push('');
        result.push('### Deprecated');
        result.push('');
        result.push('### Removed');
        result.push('');
        result.push('### Fixed');
        result.push('');
        result.push('### Security');
        result.push('');

        i += 1;

        // Carry the previously-unreleased entries into the new version,
        // dropping empty sections. Markdown link-reference definitions (e.g.
        // `[Unreleased]: https://...`) are NOT bullets: they must not leak
        // into the released section, but they are preserved in the file so the
        // `[Unreleased]` hyperlink (and any other defined label) still resolves.
        const sectionContent = new Map();
        const linkRefs = [];
        const preamble = [];
        let currentSection = null;
        // Fenced code blocks: a ```/~~~ fence toggles this flag so blank lines,
        // `###`-prefixed lines and code inside the fence are treated as plain
        // content and never mangled or treated as headings.
        let inFence = false;

        while (i < lines.length && !lines[i].startsWith('## [')) {
            const currentLine = lines[i];
            const trimmed = currentLine.trim();

            if (/^(`{3,}|~{3,})/.test(trimmed)) {
                inFence = !inFence;
            }

            if (inFence) {
                // Preserve fence contents verbatim (blank lines included).
                if (currentSection) {
                    sectionContent.get(currentSection).push(currentLine);
                } else {
                    preamble.push(currentLine);
                }
            } else if (currentLine.startsWith('### ')) {
                currentSection = currentLine;
                if (!sectionContent.has(currentSection)) {
                    sectionContent.set(currentSection, []);
                }
            } else if (trimmed === '') {
                // Blank line outside a fence: dropped.
            } else if (/^\[[^\]]+\]:\s+\S+/u.test(trimmed)) {
                // Markdown link-reference definition line.
                linkRefs.push(currentLine);
            } else if (currentSection) {
                sectionContent.get(currentSection).push(currentLine);
            } else {
                // Content above the first subsection heading must not be
                // dropped silently (lead-in note, top-level bullet, etc.).
                preamble.push(currentLine);
            }
            i += 1;
        }

        // Link-reference definitions that lived in the Unreleased block must
        // stay in the Unreleased block — never be emitted into the released
        // section. In particular the compare-style `[Unreleased]` line
        // (tsurlfilter style) is re-pointed at the new tag and emitted here, at
        // the end of the fresh Unreleased template where it originally sat.
        // Keeping it in the Unreleased block means the next finalize re-collects
        // it from there and re-points it again; emitting it after the new
        // version heading instead would strand a stale (never-again re-pointed)
        // copy inside a released section from the first release onward.
        //
        // The `releases/tag` refs live inside each version section (outside the
        // Unreleased block scanned above), so the style is detected from the
        // whole file; `[Unreleased]: .../compare/<old>...HEAD` sits in the
        // Unreleased block (tsurlfilter).
        const packageName = changelogPath.match(/packages\/([^/]+)\/CHANGELOG\.md$/)?.[1];
        const wholeContentReleaseTag = /^\[[^\]]+\]:\s+(\S*\/releases\/tag\/)[a-z0-9-]+-v[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z]+\.[0-9]+)?\s*$/m.exec(content)?.[1];
        const unreleasedCompareLine = content.split(/\r?\n/).find((line) => /^\[Unreleased\]:\s+\S*\/compare\/[a-z0-9-]+-v[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z]+\.[0-9]+)?\.\.\.HEAD\s*$/.test(line.trim()));

        const newTag = packageName ? `${packageName}-v${newVersion}` : null;
        const rePointedUnreleased = newTag
            && linkRefs.find((ref) => /^\[Unreleased\]:\s+\S+/.test(ref.trim()))
            && unreleasedCompareLine
            ? unreleasedCompareLine.trim().replace(
                /^(\[Unreleased\]:\s+\S*\/compare\/)[a-z0-9-]+-v[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z]+\.[0-9]+)?\.\.\.HEAD\s*$/,
                `$1${newTag}...HEAD`,
            )
            : null;

        if (rePointedUnreleased) {
            result.push(rePointedUnreleased);
            result.push('');
        }

        result.push(`## [${newVersion}] - ${today}`);

        // Preserve any content that appeared above the first subsection.
        if (preamble.length > 0) {
            result.push('');
            for (const item of preamble) {
                result.push(item);
            }
            result.push('');
        }

        for (const [section, items] of sectionContent.entries()) {
            if (items.length > 0) {
                result.push('');
                result.push(section);
                result.push('');
                for (const item of items) {
                    result.push(item);
                }
            }
        }

        // Emit (inside the released section) the new version's link definition
        // matching the file's style, so the new heading resolves like every
        // other one instead of rendering with literal `[x.y.z]` brackets:
        //   - per-version `.../releases/tag/<pkg>-v<version>` refs (all
        //     packages) → `[<version>]: .../releases/tag/<pkg>-v<version>`;
        //   - otherwise, when there is a compare-style `[Unreleased]` link,
        //     `[<version>]: .../compare/<old>...<new>` (keeps the compare chain
        //     intact and matches a compare-only changelog).
        // The `[Unreleased]` compare line itself was already emitted into the
        // Unreleased block above, so it is excluded here.
        let emittedRefs = linkRefs.filter((ref) => !(rePointedUnreleased && ref.trim() === unreleasedCompareLine?.trim()));

        let newVersionRef;
        if (newTag) {
            if (wholeContentReleaseTag) {
                newVersionRef = `[${newVersion}]: ${wholeContentReleaseTag}${newTag}`;
            } else if (unreleasedCompareLine) {
                const match = unreleasedCompareLine.trim().match(/^\[Unreleased\]:\s+(\S*\/compare\/)([a-z0-9-]+-v[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z]+\.[0-9]+)?)\.\.\.HEAD\s*$/);
                newVersionRef = `[${newVersion}]: ${match[1]}${match[2]}...${newTag}`;
            }
        }

        if (newVersionRef && !emittedRefs.some((ref) => ref.trim() === newVersionRef)) {
            emittedRefs.push(newVersionRef);
        }

        if (emittedRefs.length > 0) {
            result.push('');
            for (const ref of emittedRefs) {
                result.push(ref);
            }
        }

        result.push('');
        continue;
    }

    result.push(line);
    i += 1;
}

if (!foundUnreleased) {
    fail(`Could not find [Unreleased] section in ${changelogPath}`);
}

const updatedContent = result.join('\n');
fs.writeFileSync(changelogPath, updatedContent);

// Extract the new version's section for the PR body.
const updatedLines = updatedContent.split('\n');
const startIndex = updatedLines.findIndex((line) => line.startsWith(`## [${newVersion}]`));
if (startIndex === -1) {
    fail(`Could not find section for version ${newVersion} in updated ${changelogPath}`);
}
let endIndex = updatedLines.length;
for (let idx = startIndex + 1; idx < updatedLines.length; idx += 1) {
    if (/^## \[/.test(updatedLines[idx])) {
        endIndex = idx;
        break;
    }
}
const releaseNotes = updatedLines.slice(startIndex, endIndex).join('\n').trimEnd();

// Multiline output syntax: https://docs.github.com/actions/reference/workflow-commands-for-github-actions#setting-a-multiline-output-parameter
// The delimiter is randomized per run so changelog content can never close the
// heredoc early and reinterpret the payload as workflow commands.
const delimiter = `release_notes_EOF_${Date.now()}_${Math.random().toString(36).slice(2)}`;
fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `release_notes<<${delimiter}\n${releaseNotes}\n${delimiter}\n`,
);
