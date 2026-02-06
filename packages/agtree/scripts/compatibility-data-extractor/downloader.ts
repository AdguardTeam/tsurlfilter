import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Represents a Git repository resource that can be downloaded for compatibility data extraction.
 */
export interface DownloadableResource {
    /**
     * Git repository URL to clone.
     */
    gitUrl: string;

    /**
     * Local folder name where the repository will be cloned.
     */
    folderName: string;

    /**
     * Git branch to checkout. If not specified, the default branch will be used.
     */
    branch?: string;
}

export const scriptletsUrls: DownloadableResource[] = [
    {
        gitUrl: 'https://gitlab.com/eyeo/anti-cv/snippets.git',
        folderName: 'abp-scriptlets',
        branch: 'main',
    },
    {
        gitUrl: 'https://github.com/gorhill/uBlock.git',
        folderName: 'ubo',
        branch: 'master',
    },
    {
        gitUrl: 'https://github.com/AdguardTeam/Scriptlets.git',
        folderName: 'adg-scriptlets',
        branch: 'master',
    },
];

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

/**
 * Clones a git repository to the specified directory.
 *
 * @param gitUrl - The git repository URL
 * @param destination - The directory to clone into
 * @param branch - Optional branch name to clone
 */
async function cloneRepository(gitUrl: string, destination: string, branch?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const args = ['clone', '--depth', '1'];

        if (branch) {
            args.push('--branch', branch);
        }

        args.push(gitUrl, destination);

        const gitProcess = spawn('git', args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderr = '';

        gitProcess.stdout?.on('data', (data) => {
            process.stdout.write(data);
        });

        gitProcess.stderr?.on('data', (data) => {
            stderr += data.toString();
            process.stderr.write(data);
        });

        gitProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Git clone failed with code ${code}: ${stderr}`));
            }
        });

        gitProcess.on('error', (err) => {
            reject(new Error(`Failed to spawn git: ${err.message}`));
        });
    });
}

/**
 * Clones multiple git repositories to the downloads folder.
 *
 * @param resources - Array of git repositories with URLs and folder names
 */
export async function cloneRepositories(resources: DownloadableResource[]): Promise<void> {
    try {
        await fs.rm(DOWNLOADS_DIR, { recursive: true, force: true });
    } catch {
        // Directory doesn't exist, ignore
    }
    await fs.mkdir(DOWNLOADS_DIR, { recursive: true });

    console.log(`Cloning ${resources.length} repositories...`);

    for (const resource of resources) {
        const cloneDir = path.join(DOWNLOADS_DIR, resource.folderName);

        console.log(`Cloning: ${resource.gitUrl} (${resource.branch || 'default branch'})`);
        await cloneRepository(resource.gitUrl, cloneDir, resource.branch);

        console.log(`✓ Completed: ${resource.folderName}`);
    }

    console.log('All repositories cloned!');
}
