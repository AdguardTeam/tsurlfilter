import Bowser from 'bowser';

const browserDetector = Bowser.getParser(window.navigator.userAgent);

const browserDetails = browserDetector.getBrowser();

export const isChrome = browserDetails.name === 'Chrome';
