/* eslint-disable no-console */
import fs from 'fs';
// eslint-disable-next-line import/no-extraneous-dependencies
import archiver from 'archiver';

/**
 * Asynchronously zips a directory and saves the archive to a specified output path.
 *
 * @param sourceDir - The source directory you want to zip.
 * @param outPath - The output path for the zip file.
 * @returns Promise that resolves when the archive has been finalized.
 */
export const zipDirectory = (sourceDir: string, outPath: string): Promise<void> => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', {
        zlib: { level: 9 },
    });

    // Explicitly typing the resolve and reject functions
    let resolveArchivePromise: () => void;
    let rejectArchivePromise: (error: Error) => void;

    const archivePromise = new Promise<void>((resolve, reject) => {
        resolveArchivePromise = resolve;
        rejectArchivePromise = reject;
    });

    output.on('close', () => {
        console.log(`Archive created successfully. Total bytes: ${archive.pointer()}`);
        if (resolveArchivePromise) {
            resolveArchivePromise();
        }
    });

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
            // Log warning
            console.warn(err);
        } else if (rejectArchivePromise) {
            rejectArchivePromise(err);
        }
    });

    archive.on('error', (err) => {
        if (rejectArchivePromise) {
            rejectArchivePromise(err);
        }
    });

    // Pipe archive data to the file.
    archive.pipe(output);

    // Append files from a directory, recursively.
    archive.directory(sourceDir, false);

    // Begin the archiving process.
    archive.finalize();

    // Return the promise that resolves upon archive completion.
    return archivePromise;
};
