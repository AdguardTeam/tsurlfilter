/**
 * @file Raw compatibility tables data reexport from yaml files.
 *
 * '@ts-nocheck' is used here once instead of adding @ts-ignore for each import.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import app from './modifiers/app.yml';
import badfilter from './modifiers/badfilter.yml';
import cname from './modifiers/cname.yml';
import content from './modifiers/content.yml';
import cookie from './modifiers/cookie.yml';
import csp from './modifiers/csp.yml';
import denyallow from './modifiers/denyallow.yml';
import document from './modifiers/document.yml';
import domain from './modifiers/domain.yml';
import elemhide from './modifiers/elemhide.yml';
import extension from './modifiers/extension.yml';
import font from './modifiers/font.yml';
import genericblock from './modifiers/genericblock.yml';
import generichide from './modifiers/generichide.yml';
import header from './modifiers/header.yml';
import hls from './modifiers/hls.yml';
import image from './modifiers/image.yml';
import important from './modifiers/important.yml';
import inlineFont from './modifiers/inline-font.yml';
import jsinject from './modifiers/jsinject.yml';
import jsonprune from './modifiers/jsonprune.yml';
import matchcase from './modifiers/matchcase.yml';
import media from './modifiers/media.yml';
import object from './modifiers/object.yml';
import other from './modifiers/other.yml';
import ping from './modifiers/ping.yml';
import popunder from './modifiers/popunder.yml';
import popup from './modifiers/popup.yml';
import redirectRule from './modifiers/redirect-rule.yml';
import removeheader from './modifiers/removeheader.yml';
import script from './modifiers/script.yml';
import stealth from './modifiers/stealth.yml';
import strict1p from './modifiers/strict1p.yml';
import strict3p from './modifiers/strict3p.yml';
import stylesheet from './modifiers/stylesheet.yml';
import subdocument from './modifiers/subdocument.yml';
import thirdParty from './modifiers/third-party.yml';
import to from './modifiers/to.yml';
import urlblock from './modifiers/urlblock.yml';
import webrtc from './modifiers/webrtc.yml';
import websocket from './modifiers/websocket.yml';
import xmlhttprequest from './modifiers/xmlhttprequest.yml';

import { type RawModifierData } from '.';

export const rawModifiersData: RawModifierData = {
    app,
    badfilter,
    cname,
    content,
    cookie,
    csp,
    denyallow,
    document,
    domain,
    elemhide,
    extension,
    font,
    genericblock,
    generichide,
    header,
    hls,
    image,
    important,
    inlineFont,
    jsinject,
    jsonprune,
    matchcase,
    media,
    object,
    other,
    ping,
    popunder,
    popup,
    redirectRule,
    removeheader,
    script,
    stealth,
    strict1p,
    strict3p,
    stylesheet,
    subdocument,
    thirdParty,
    to,
    urlblock,
    webrtc,
    websocket,
    xmlhttprequest,
};
