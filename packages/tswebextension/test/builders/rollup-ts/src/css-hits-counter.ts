// Don't check types because this dependency will be installed manually via test.sh
// @ts-ignore
import { CssHitsCounter } from '@adguard/tswebextension/content-script/css-hits-counter';

const cssHitsCounter = (): void => {
    console.log(CssHitsCounter);
};

export { cssHitsCounter };
