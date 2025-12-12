import path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BUILD_PATH = path.join(__dirname, '../build/extension');

export const BUILD_ZIP_FILE_NAME = 'extension.zip';

export const WEB_ACCESSIBLE_RESOURCES_PATH = path.join(__dirname, '../build/extension/war');

export const BACKGROUND_PATH = path.join(__dirname, '../extension/pages/background');

export const CONTENT_SCRIPT = path.join(__dirname, '../extension/pages/content-script');

export const ASSISTANT_INJECT = path.join(__dirname, '../extension/pages/assistant-inject');

export const POPUP_PATH = path.join(__dirname, '../extension/pages/popup');

export const BLOCKING_PAGE_PATH = path.join(__dirname, '../extension/pages/blocking-page');
