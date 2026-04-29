import { initRemoveParam } from '../../common/content-script/remove-param-handler';

import { CookieController } from './cookie-controller';
import { CosmeticController } from './cosmetic-controller';

const cosmeticController = new CosmeticController();
cosmeticController.init();

const cookieController = new CookieController();
cookieController.init();

initRemoveParam();
