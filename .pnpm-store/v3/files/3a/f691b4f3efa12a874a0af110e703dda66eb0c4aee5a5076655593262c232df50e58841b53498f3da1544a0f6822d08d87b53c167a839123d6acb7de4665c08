import { calculateChecksumSHA1 } from '../common/calculate-checksum';
import { DIFF_PATH_TAG } from '../common/constants';
import { TypesOfChanges } from '../common/types-of-change';
import { parseDiffDirective } from '../common/diff-directive';
import { parsePatchName, timestampWithResolutionToMs } from '../common/patch-name';
import { splitByLines } from '../common/split-by-lines';
import { createLogger } from '../common/create-logger';
import { getErrorMessage } from '../common/get-error-message';
import { parseTag } from '../diff-builder/tags';
import { UnacceptableResponseError } from './unacceptable-response-error';

/**
 * Interface describing the parameters of the applyPatch function.
 */
export interface ApplyPatchParams {
    /**
     * The URL from which the RCS patch can be obtained.
     * @type {string}
     */
    filterUrl: string;

    /**
     * The original filter content as a string.
     * @type {string}
     */
    filterContent: string;

    /**
     * Whether to enable verbose mode.
     * @type {boolean}
     */
    verbose?: boolean;
}

/**
 * Represents an RCS (Revision Control System) operation.
 */
interface RcsOperation {
    /**
     * The type of RCS operation (Add or Delete).
     */
    typeOfOperation: TypesOfChanges;

    /**
     * The starting index of the operation.
     */
    startIndex: number;

    /**
     * The number of lines affected by the operation.
     */
    numberOfLines: number;
}

/**
 * If the differential update is not available the server may signal about that
 * by returning one of the following responses.
 *
 * @see @link Step 3 in https://github.com/ameshkov/diffupdates?tab=readme-ov-file#algorithm
 */
const AcceptableHttpStatusCodes = {
    NotFound: 404,
    NoContent: 204,
    Ok: 200,
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare
type AcceptableHttpStatusCodes = typeof AcceptableHttpStatusCodes[keyof typeof AcceptableHttpStatusCodes];

/**
 * Parses an RCS (Revision Control System) operation string into an object
 * containing operation details.
 *
 * @param rcsOperation The RCS operation string to parse.
 *
 * @returns An object with the parsed operation details.
 *
 * @throws Throws an error if the operation string is not valid.
 */
const parseRcsOperation = (rcsOperation: string): RcsOperation => {
    const [operationInfo, operationCounter] = rcsOperation.split(' ');

    const typeOfOperation = operationInfo[0];
    // Indexes in RCS are natural so we need to subtract 1.
    const startIndex = Number(operationInfo.slice(1)) - 1;
    const numberOfLines = Number(operationCounter);

    if (typeOfOperation !== TypesOfChanges.Add && typeOfOperation !== TypesOfChanges.Delete) {
        throw new Error(`Operation is not valid: cannot parse type: ${rcsOperation}`);
    }

    if (Number.isNaN(startIndex)) {
        throw new Error(`Operation is not valid: cannot parse index: ${rcsOperation}`);
    }

    if (Number.isNaN(numberOfLines)) {
        throw new Error(`Operation is not valid: cannot parse number of lines: ${rcsOperation}`);
    }

    return {
        typeOfOperation,
        startIndex,
        numberOfLines,
    };
};

/**
 * Applies an RCS (Revision Control System) patch to a filter content.
 *
 * @param filterContent An array of strings representing the original filter content.
 * @param patch An array of strings representing the RCS patch to apply.
 * @param checksum An optional checksum to validate the updated filter content.
 * @returns The updated filter content after applying the patch.
 * @throws If the provided checksum doesn't match the calculated checksum.
 */
export const applyRcsPatch = (
    filterContent: string[],
    patch: string[],
    checksum?: string,
): string => {
    // Make a copy
    const lines = filterContent.slice();

    // NOTE: Note that the line indices start always refer to the text which is
    // transformed as it is in its original state, without taking the precending
    // changes into account, so we need to collect "virtual offset" between
    // "current changing" file and "old file".
    let currentOffset = 0;

    for (let index = 0; index < patch.length; index += 1) {
        const patchLine = patch[index];

        // Skip empty lines
        if (patchLine === '') {
            continue;
        }

        const parsedRcsOperation = parseRcsOperation(patchLine);
        const {
            typeOfOperation,
            startIndex,
            numberOfLines,
        } = parsedRcsOperation;

        const startIndexWithOffset = startIndex + currentOffset;

        if (typeOfOperation === TypesOfChanges.Delete) {
            lines.splice(startIndexWithOffset, numberOfLines);

            currentOffset -= numberOfLines;
        }

        if (typeOfOperation === TypesOfChanges.Add) {
            const stringsToAdd: string[] = [];
            let nStringsToAdd = numberOfLines;
            // Scan strings to add starting from the second line.
            let scanFrom = index + 1;
            while (nStringsToAdd > 0 && scanFrom < patch.length) {
                stringsToAdd.push(patch[scanFrom]);
                scanFrom += 1;
                nStringsToAdd -= 1;
            }
            index += stringsToAdd.length;

            if (startIndexWithOffset < 0) {
                lines.unshift(...stringsToAdd);
            } else if (startIndexWithOffset > lines.length) {
                lines.push(...stringsToAdd);
            } else {
                lines.splice(startIndexWithOffset + 1, 0, ...stringsToAdd);
            }

            currentOffset += numberOfLines;
        }
    }

    const updatedFilter = lines.join('');

    if (checksum) {
        const c = calculateChecksumSHA1(updatedFilter);

        if (c !== checksum) {
            throw new Error('Checksums are not equal.');
        }
    }

    return updatedFilter;
};

/**
 * Checks if a patch has expired based on its timestamp and time-to-live (TTL).
 *
 * @param diffPath - The path of the patch file.
 * @returns `true` if the patch has expired, `false` otherwise.
 */
const checkPatchExpired = (diffPath: string): boolean => {
    const {
        resolution,
        epochTimestamp,
        time,
    } = parsePatchName(diffPath);

    const createdMs = timestampWithResolutionToMs(epochTimestamp, resolution);
    const ttlMs = timestampWithResolutionToMs(time, resolution);

    return Date.now() > createdMs + ttlMs;
};

/**
 * Downloads a file from a specified URL and returns its content as a string.
 *
 * @param baseURL The base URL of the file.
 * @param fileUrl The URL from which to download the file.
 * @param isFileHostedViaNetworkProtocol Indicates whether the file is hosted
 * via a network protocol (http/https).
 * If `isFileHostedViaNetworkProtocol` is `true`, the function accepts HTTP
 * status codes based on the `AcceptableHttpStatusCodes` enumeration.
 * If `isFileHostedViaNetworkProtocol` is `false`, only 2xx status codes are
 * accepted, indicating a successful local or similar file request.
 * Any other status codes result in an error.
 * @param isRecursiveUpdate Indicates whether the function is called recursively.
 * @param log A function that logs a message.
 *
 * @returns A promise that resolves to the content of the downloaded file
 * as a string.
 *
 * @throws
 * 1. An {@link Error} if:
 *      - there is an error during the network request,
 *      - the file is not found,
 *      - or the file is empty.
 * 2. The {@link UnacceptableResponseError} if network-hosted file request
 * returns an unacceptable status code, e.g. 403.
 */
const downloadFile = async (
    baseURL: string,
    fileUrl: string,
    isFileHostedViaNetworkProtocol: boolean,
    isRecursiveUpdate: boolean,
    log: (message: string) => void,
): Promise<string[] | null> => {
    try {
        const response = await fetch(new URL(fileUrl, `${baseURL}/`));

        // For local and similar files, accept only 2xx status codes.
        if (!isFileHostedViaNetworkProtocol && !(response.status >= 200 && response.status < 300)) {
            log(`Error during file request: ${response.status} ${response.statusText}`);
            return null;
        }

        // For network-hosted files, accept status codes defined in AcceptableHttpStatusCodes.
        if (isFileHostedViaNetworkProtocol) {
            const acceptableHttpStatusCodes: number[] = Object.values(AcceptableHttpStatusCodes);
            if (!acceptableHttpStatusCodes.includes(response.status)) {
                const err = `Unacceptable response for network request: ${response.status} ${response.statusText}`;
                log(err);
                throw new UnacceptableResponseError(err);
            }
        }

        if ((response.status === AcceptableHttpStatusCodes.NotFound
            || response.status === AcceptableHttpStatusCodes.NoContent) && !isRecursiveUpdate) {
            log('Update is not available.');
            return null;
        }

        const data = await response.text();
        if (response.status === AcceptableHttpStatusCodes.Ok && data === '') {
            if (!isRecursiveUpdate) {
                log('Update is not available.');
            }
            return null;
        }

        return splitByLines(data);
    } catch (e) {
        // We ignore errors for local files
        if (!isFileHostedViaNetworkProtocol) {
            log(`Error during file request to "${baseURL}"/"${fileUrl}": ${getErrorMessage(e)}`);
            return null;
        }
        if (e instanceof UnacceptableResponseError) {
            // re-throw the error as is
            throw e;
        }
        throw new Error(`Error during network request: ${getErrorMessage(e)}`, { cause: e });
    }
};

/**
 * Extracts the base URL or directory path from a given URL or file path.
 * It identifies the appropriate delimiter (forward slash '/' for URLs and
 * POSIX file paths, or backslash '\' for Windows file paths), splits the string
 * using this delimiter, and then rejoins the parts excluding the last segment.
 * This effectively removes the file name or the last part of the path,
 * returning only the base path.
 *
 * @param filterUrl The URL or file path from which to extract the base.
 *
 * @returns The base URL or directory path without the last segment.
 */
export const extractBaseUrl = (filterUrl: string): string => {
    let splitDelimeter = '/';
    if (filterUrl.includes('\\')) {
        splitDelimeter = '\\';
    }

    // Remove the last part of the URL, which is the file name, and replace
    // it with the patch name because the patch name is relative to the filter URL.
    return filterUrl
        .split(splitDelimeter)
        .slice(0, -1)
        .join(splitDelimeter);
};

/**
 * Applies an RCS (Revision Control System) patch to update a filter's content.
 *
 * @param params The parameters for applying the patch {@link ApplyPatchParams}.
 *
 * @returns A promise that resolves to the updated filter content after applying the patch,
 * or null if there is no Diff-Path tag in the filter.
 *
 * @throws
 * 1. An {@link Error} if there is an error during
 *     - the patch application process
 *     - during network request.
 * 2. The {@link UnacceptableResponseError} if the network request returns an unacceptable status code.
 */
export const applyPatch = async (params: ApplyPatchParams): Promise<string | null> => {
    // Wrapper to hide the callStack parameter from the user.
    const applyPatchWrapper = async (innerParams: ApplyPatchParams & { callStack: number }): Promise<string | null> => {
        const {
            filterUrl,
            filterContent,
            verbose = false,
            callStack,
        } = innerParams;

        const filterLines = splitByLines(filterContent);

        // Remove resourceName part after "#" sign if it exists.
        const diffPath = parseTag(DIFF_PATH_TAG, filterLines)?.split('#')[0];

        if (!diffPath) {
            return null;
        }

        // If the patch has not expired yet, return the filter content without changes.
        if (!checkPatchExpired(diffPath)) {
            return filterContent;
        }

        const log = createLogger(verbose);
        let patch: string[] = [];

        try {
            const baseUrl = extractBaseUrl(filterUrl);
            const res = await downloadFile(
                baseUrl,
                diffPath,
                baseUrl.startsWith('http://') || baseUrl.startsWith('https://'),
                callStack > 0,
                log,
            );

            // Update is not available yet.
            if (res === null) {
                return filterContent;
            }

            patch = res;
        } catch (e) {
            if (e instanceof UnacceptableResponseError) {
                // re-throw the error as is
                throw e;
            }
            // eslint-disable-next-line max-len
            throw new Error(`Error during downloading patch file from "${diffPath}": ${getErrorMessage(e)}`, { cause: e });
        }

        let updatedFilter: string = '';

        try {
            const diffDirective = parseDiffDirective(patch[0]);
            updatedFilter = applyRcsPatch(
                filterLines,
                // Remove the diff directive if it exists in the patch.
                diffDirective ? patch.slice(1) : patch,
                diffDirective ? diffDirective.checksum : undefined,
            );
        } catch (e) {
            throw new Error(`Error during applying the patch from "${diffPath}": ${getErrorMessage(e)}`, { cause: e });
        }

        try {
            const recursiveUpdatedFilter = await applyPatchWrapper({
                filterUrl,
                filterContent: updatedFilter,
                callStack: callStack + 1,
                verbose,
            });

            // It can be null if the filter dropped support for Diff-Path in new versions.
            if (recursiveUpdatedFilter === null) {
                // Then we return the filter with the last successfully applied patch.
                return updatedFilter;
            }

            return recursiveUpdatedFilter;
        } catch (e) {
            // If we catch an error during the recursive update, we will return
            // the last successfully applied patch.
            return updatedFilter;
        }
    };

    return applyPatchWrapper(Object.assign(params, { callStack: 0 }));
};
