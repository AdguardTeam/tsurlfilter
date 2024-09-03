/// <reference types="node" />
import fs from 'fs';
import { Request, RequestHandler } from 'express';
import download from 'download';
declare type ApiError = Error & {
    extraInfo?: string;
    status?: number;
};
declare type CreateApiErrorParams = {
    message: string;
    extraInfo?: string;
    status?: number;
};
export declare const createApiError: ({ message, extraInfo, status, }: CreateApiErrorParams) => ApiError;
export declare type RequestWithFiles = Request & {
    xpiFilepath?: string;
};
export declare type FunctionConfig = {
    _console?: typeof console;
    _download?: typeof download;
    _process?: typeof process;
    _unlinkFile?: typeof fs.promises.unlink;
    apiKeyEnvVarName?: string;
    requiredApiKeyParam?: string;
    requiredDownloadUrlParam?: string;
    tmpDir?: string;
    xpiFilename?: string;
};
export declare const createExpressApp: ({ _console, _download, _process, _unlinkFile, apiKeyEnvVarName, requiredApiKeyParam, requiredDownloadUrlParam, tmpDir, xpiFilename, }?: FunctionConfig) => (handler: RequestHandler) => import("express-serve-static-core").Express;
export {};
