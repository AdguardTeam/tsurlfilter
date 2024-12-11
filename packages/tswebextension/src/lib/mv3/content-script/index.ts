import { initAssistant } from './assistant';
import { CookieController } from './cookie-controller';
import { CosmeticController } from './cosmetic-controller';

interface CustomWindow extends Window {
    isAssistantInitiated: boolean;
}

declare const global: CustomWindow;

const cosmeticController = new CosmeticController();
cosmeticController.init();

const cookieController = new CookieController();
cookieController.init();

// Init assistant only once
if (!global.isAssistantInitiated) {
    initAssistant();
    global.isAssistantInitiated = true;
}
