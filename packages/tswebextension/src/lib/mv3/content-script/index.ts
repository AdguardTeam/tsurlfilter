import { initAssistant } from './assistant';
import { CookieController } from './cookie-controller';
import { CosmeticController } from './cosmetic-controller';

interface CustomWindow extends Window {
    isAssistantInitiated: boolean;
}

const customWindow: CustomWindow = window as unknown as CustomWindow;

const cosmeticController = new CosmeticController();
cosmeticController.init();

const cookieController = new CookieController();
cookieController.init();

// Init assistant only once
if (!customWindow.isAssistantInitiated) {
    initAssistant();
    customWindow.isAssistantInitiated = true;
}
