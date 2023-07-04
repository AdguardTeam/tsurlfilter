/**
 * @file Raw compatibility tables data reexport from yaml files.
 *
 * '@ts-nocheck' is used here once instead of adding @ts-ignore for each import.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// Please keep imports and exports in alphabetical order

import all from './modifiers/all.yml';
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
import empty from './modifiers/empty.yml';
import firstParty from './modifiers/first-party.yml';
import extension from './modifiers/extension.yml';
import font from './modifiers/font.yml';
import genericblock from './modifiers/genericblock.yml';
import generichide from './modifiers/generichide.yml';
import header from './modifiers/header.yml';
import hls from './modifiers/hls.yml';
import image from './modifiers/image.yml';
import important from './modifiers/important.yml';
import inlineFont from './modifiers/inline-font.yml';
import inlineScript from './modifiers/inline-script.yml';
import jsinject from './modifiers/jsinject.yml';
import jsonprune from './modifiers/jsonprune.yml';
import matchCase from './modifiers/matchcase.yml';
import media from './modifiers/media.yml';
import method from './modifiers/method.yml';
import mp4 from './modifiers/mp4.yml';
import network from './modifiers/network.yml';
import noop from './modifiers/noop.yml';
import objectSubrequest from './modifiers/object-subrequest.yml';
import object from './modifiers/object.yml';
import other from './modifiers/other.yml';
import permissions from './modifiers/permissions.yml';
import ping from './modifiers/ping.yml';
import popunder from './modifiers/popunder.yml';
import popup from './modifiers/popup.yml';
import redirectRule from './modifiers/redirect-rule.yml';
import redirect from './modifiers/redirect.yml';
import removeheader from './modifiers/removeheader.yml';
import removeparam from './modifiers/removeparam.yml';
import script from './modifiers/script.yml';
import specifichide from './modifiers/specifichide.yml';
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

import { type RawModifierData } from './types';

export const rawModifiersData: RawModifierData = {
    all,
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
    empty,
    firstParty,
    extension,
    font,
    genericblock,
    generichide,
    header,
    hls,
    image,
    important,
    inlineFont,
    inlineScript,
    jsinject,
    jsonprune,
    matchCase,
    media,
    method,
    mp4,
    network,
    noop,
    objectSubrequest,
    object,
    other,
    permissions,
    ping,
    popunder,
    popup,
    redirectRule,
    redirect,
    removeheader,
    removeparam,
    script,
    specifichide,
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
