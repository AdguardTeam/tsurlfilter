import { createAssistantMessageListener } from '../../common/content-script/assistant/assistant-listener';

import { CookieController } from './cookie-controller';
import { CosmeticController } from './cosmetic-controller';

const cosmeticController = new CosmeticController();
cosmeticController.init();

const cookieController = new CookieController();
cookieController.init();

createAssistantMessageListener();
