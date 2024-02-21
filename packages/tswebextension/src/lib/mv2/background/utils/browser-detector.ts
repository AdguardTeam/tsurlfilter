import Bowser from 'bowser';

const browserDetector = Bowser.getParser(window.navigator.userAgent);

const browserDetails = browserDetector.getBrowser();

const engineDetails = browserDetector.getEngine();

export const isOpera = browserDetails.name === 'Opera';

export const isFirefox = browserDetails.name === 'Firefox';

export const isChrome = browserDetails.name === 'Chrome';

export const isChromium = engineDetails.name === 'Blink';
