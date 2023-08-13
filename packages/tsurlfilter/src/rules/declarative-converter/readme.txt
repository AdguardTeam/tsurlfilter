! # Description
! This file contains examples of converting filter rules to new MV3 declarative
! rules and describes some MV3-specific limitations of the converted rules.
! For a full description of each modifier, see the knowledgebase https://adguard.com/kb/general/ad-filtering/create-own-filters.

! <br />
! <br />
!
! # MV3 specific limitations
! ## allowrules
! Allowrules currently are not supported for these modifiers:
! 1. some specific exceptions: `$genericblock`, `$jsinject`, `$urlblock`, `$content`, `$stealth`.
! 1. `$redirect`
! 1. `$removeparam`
! 1. `$removeheader`
! 1. `$csp`
!
! ## $document
! During convertion process exception with $document modificator is expanded
! into `$elemhide,content,urlblock,jsinject` of which:
! - `$content` - not supported in the MV3,
! - `$elemhide` - supported,
! - `$jsinject` - not implemented yet,
! - `$urlblock` - not implemented yet.
!
! So we still convert rules with `$document`, but only part with `$elemhide`
! will be applied.
!
! ## $removeparam, $removeheader, $csp
! Rules with `$removeparam` or `$removeheader` or `$csp` which contains the same
! conditions are combined into one rule only within one filter but not across
! different filters. Because of that, rules from different filter can conflict.
!
! ## $redirect-rule
! Works as `$redirect`.

! <br />
! <br />
!
! # Basic examples
! Blocking by domain name
||example.org^

! Blocking exact address
|http://example.org/

! Basic rule modifiers
||example.org^$script,third-party,domain=example.com

! Unblocking an address
@@||example.org/banner

! Unblocking everything on a website
@@||example.org^$document

! Cosmetic rule will be ignored
example.org##.banner

! <br />
! <br />
!
! # Basic modifiers

! ## $denyallow
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
*$script,domain=a.com|b.com,denyallow=x.com|y.com

! ## $domain
! <b>Status</b>: partial supported
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Doesn't support regexps and any tld domains
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||baddomain.com^$domain=example.org
! example 2
||baddomain.com^$domain=example.org|example.com
! example 3
||baddomain.com^$domain=~example.org
! example 4
||baddomain.com^$domain=example.org|~foo.example.org
! example 5
||baddomain.com^$domain=/(^\\|.+\\.)example\\.(com\\|org)\\$/
! example 6
||baddomain.com^$domain=~a.com|~b.*|~/(^\\|.+\\.)c\\.(com\\|org)\\$/
! example 7
*$cookie,domain=example.org|example.com
! example 8
*$document,domain=example.org|example.com
! example 9
page$domain=example.org
! example 10
page$domain=targetdomain.com
! example 11
||*page$domain=targetdomain.com
! example 12
||*page$domain=targetdomain.com,cookie
! example 13
/banner\d+/$domain=targetdomain.com
! example 14
page$domain=targetdomain.com|~example.org

! ## $header
! <b>Status</b>: not supported
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Cannot be converted to MV3 Declarative Rule
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.com^$header=set-cookie:foo
! example 2
||example.com^$header=set-cookie
! example 3
@@||example.com^$header=set-cookie:/foo\, bar\$/
! example 4
@@||example.com^$header=set-cookie


! ## $important
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1.
! <br/>
! blocking rule will block all requests despite of the exception rule
||example.org^$important
@@||example.org^
! example 2.
! <br/>
! if the exception rule also has `$important` modifier it will prevail,
! so no requests will not be blocked
||example.org^$important
@@||example.org^$important
! example 3.
! <br/>
! if a document-level exception rule is applied to the document,
! the `$important` modifier will be ignored;
! so if a request to `example.org` is sent from the `test.org` domain,
! the blocking rule will not be applied despite it has the `$important` modifier
||example.org^$important
@@||test.org^$document

! ## $match-case
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
*/BannerAd.gif$match-case

! ## $method
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||evil.com^$method=get|head
! example 2
||evil.com^$method=~post|~put
! example 3
@@||evil.com$method=get
! example 4
@@||evil.com$method=~post

! ## $popup
! <b>Status</b>: not implemented yet
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Cannot be converted to MV3 Declarative Rule, but maybe can be implemented on
! the content-script side
! <br/>
! <b>Examples:</b>
! <br/>
||domain.com^$popup

! ## $third-party
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||domain.com^$third-party
! example 2
||domain.com$~third-party

! ## $to
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
/ads$to=evil.com|evil.org
! example 2
/ads$to=~not.evil.com|evil.com
! example 3
/ads$to=~good.com|~good.org

! <br />
! <br />
!
! # Content type modifiers
! <b>Status</b>: all content type modifiers supported, except deprecated $webrtc and $object-subrequest.
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org^$image
! example 2
||example.org^$script,stylesheet
! example 3
||example.org^$~image,~script,~stylesheet

! ## $document
! example 1
@@||example.com^$document
! example 2
@@||example.com^$document,~extension
! example 3
||example.com^$document
! example 4
||example.com^$document,redirect=noopframe
! example 5
||example.com^$document,removeparam=test
! example 6
||example.com^$document,replace=/test1/test2/

! ## $image
||example.org^$image

! ## $stylesheet
||example.org^$stylesheet

! ## $script
||example.org^$script

! ## $object
||example.org^$object

! ## $font
||example.org^$font

! ## $media
||example.org^$media

! ## $subdocument
! example 1
||example.com^$subdocument
! example 2
||example.com^$subdocument,domain=domain.com

! ## $ping
||example.org^$ping

! ## $xmlhttprequest
||example.org^$xmlhttprequest

! ## $websocket
||example.org^$websocket

! ## $webrtc
! <b>Status</b>: not supported
! <br/>
! example 1
||example.com^$webrtc,domain=example.org
! example 2
@@*$webrtc,domain=example.org

! ## $other
||example.org^$other

! <br />
! <br />
!
! # Exception rules modifiers

! ## $content
! <b>Status</b>: not supported in MV3
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.com^$content

! ## $elemhide
! <b>Status</b>: supported but not converted.
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Not convertible to DNR in MV3, but in MV3 [tswebextension](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tswebextension) uses content-script to request cosmetic rules from tsurlfilter's with [MatchingResult.getCosmeticOption](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/engine/matching-result.ts#L235), where $elemhide, $specifichide and $generichide will be applied.
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.com^$elemhide

! ## $jsinject
! <b>Status</b>: not implemented yet
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.com^$jsinject

! ## $stealth
! <b>Status</b>: not implemented yet
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
@@||example.com^$stealth
! example 2
@@||domain.com^$script,stealth,domain=example.com

! ## $urlblock
! <b>Status</b>: not implemented yet
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.com^$urlblock

! ## $genericblock
! <b>Status</b>: not implemented yet
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.com^$genericblock

! ## $generichide
! <b>Status</b>: supported but not converted.
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Not convertible to DNR in MV3, but in MV3 [tswebextension](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tswebextension) uses content-script to request cosmetic rules from tsurlfilter's with [MatchingResult.getCosmeticOption](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/engine/matching-result.ts#L235), where $elemhide, $specifichide and $generichide will be applied.
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.com^$generichide

! ## $specifichide
! <b>Status</b>: supported but not converted.
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Not convertible to DNR in MV3, but in MV3 [tswebextension](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tswebextension) uses content-script to request cosmetic rules from tsurlfilter's with [MatchingResult.getCosmeticOption](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/engine/matching-result.ts#L235), where $elemhide, $specifichide and $generichide will be applied.
! <br/>
! <b>Examples:</b>
! <br/>
@@||example.org^$specifichide

! <br />
! <br />
!
! # Advanced capabilities

! ## $all
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
||example.org^$all

! ## $badfilter
! <b>Status</b>: partial support
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Works only within the scope of one static filter or within the scope of all
! dynamic rules (custom filters and user rules).
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.com
||example.com$badfilter
! example 2
||example.com,image
||example.com$image,badfilter
! example 3
@@||example.com
@@||example.com$badfilter
! example 4
||example.com$domain=domain.com
||example.com$domain=domain.com,badfilter
! example 5
/some$domain=example.com|example.org|example.io
/some$domain=example.com,badfilter
! example 6
/some$domain=example.com|example.org|example.io
/some$domain=example.com|example.org,badfilter
! example 7
/some$domain=example.com|example.org
/some$domain=example.com|example.org|example.io,badfilter
! example 8
/some$domain=example.com|example.org|example.io
/some$domain=example.*,badfilter
! example 9
/some$domain=example.*
/some$domain=example.com|example.org,badfilter
! example 10
/some$domain=example.com|example.org|example.io
/some$domain=example.com|~example.org,badfilter

! ## $cookie
! <b>Status</b>: implemented in `release/v2.2` branch
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org^$cookie=NAME;maxAge=3600;sameSite=lax
! example 2
||example.org^$cookie
! example 3
||example.org^$cookie=NAME
! example 4
||example.org^$cookie=/regexp/
! example 5
@@||example.org^$cookie
! example 6
@@||example.org^$cookie=NAME
! example 7
@@||example.org^$cookie=/regexp/
! example 8
$cookie=__cfduid
! example 9
$cookie=/__utm[a-z]/
! example 10
||facebook.com^$third-party,cookie=c_user

! ## $csp
! <b>Status</b>: supported
! <br/>
! Allowlist rules are not supported
! <br/>
! Rules with the same matching condition are combined into one, but only within
! the scope of one static filter or within the scope of all dynamic rules
! (custom filters and user rules).
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org^$csp=frame-src 'none'
! example 2
@@||example.org/page/*$csp=frame-src 'none'
! example 3
@@||example.org/page/*$csp
! example 4
||example.org^$csp=script-src 'self' 'unsafe-eval' http: https:
! example 5
||example.org^$csp=script-src 'self' 'unsafe-eval' http: https:
@@||example.org^$document

! ## $permissions
! <b>Status</b>: not implemented yet
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org^$permissions=sync-xhr=()
! example 2
@@||example.org/page/*$permissions=sync-xhr=()
! example 3
@@||example.org/page/*$permissions
! example 4
$domain=example.org|example.com,permissions=oversized-images=()\, sync-script=()\, unsized-media=()
! example 5
||example.org^$permissions=sync-xhr=()
@@||example.org^$document

! ## $redirect
! <b>Status</b>: partial support
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Allowlist rules are not supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org/script.js$script,redirect=noopjs
! example 2
||example.org/test.mp4$media,redirect=noopmp4-1s
! example 3
@@||example.org^$redirect
! example 4
@@||example.org^$redirect=noopjs
! example 5
||*/redirect-test.css$redirect=noopcss
! example 6
||*/redirect-test.js$redirect=noopjs
! example 7
||*/redirect-test.png$redirect=2x2-transparent.png
! example 8
||*/redirect-test.html$redirect=noopframe
! example 9
||*/redirect-test.txt$redirect=nooptext
! example 10
||*/redirect-exception-test.js$redirect=noopjs
@@||*/redirect-exception-test.js
! example 11
||*/redirect-priority-test.js$redirect=noopjs
||*/redirect-priority-test.js$important,csp=script-src 'self'

! ## $redirect-rule
! <b>Status</b>: not supported
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Converting as $redirect rules
! <br/>
! <b>Examples:</b>
! <br/>
||example.org/script.js
||example.org^$redirect-rule=noopjs

! ## $referrerpolicy
! <b>Status</b>: not implemented yet
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.com^$referrerpolicy=unsafe-urlblock
! example 2
@@||example.com^$referrerpolicy=unsafe-urlblock
! example 3
@@||example.com/abcd.html^$referrerpolicy

! ## $removeheader
! <b>Status</b>: supported
! <br/>
! Allowlist rules are not supported
! <br/>
! Rules with the same matching condition are combined into one, but only within
! the scope of one static filter or within the scope of all dynamic rules
! (custom filters and user rules).
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org^$removeheader=header-name
! example 2
||example.org^$removeheader=request:header-name
! example 3
@@||example.org^$removeheader
! example 4 (with limitations)
@@||example.org^$removeheader=header
! example 5
||example.org^$removeheader=refresh
! example 6
||example.org^$removeheader=request:x-client-data
! example 8
$removeheader=location,domain=example.com

! ## $removeparam
! <b>Status</b>: partial supported
! <br/>
! <b>MV3 limitations:</b>
! <br/>
! Allowlist rules are not supported
! <br/>
! Regexps, negation and allow-rules are not supported
! <br/>
! Rules with the same matching condition are combined into one, but only within
! the scope of one static filter or within the scope of all dynamic rules
! (custom filters and user rules).
! <br/>
! <b>Examples:</b>
! <br/>
! example 1.
! skip rules with a negation, or regexp or the rule is a allowlist
||example.org^$removeparam
! example 2
$removeparam=~param
! example 3
$removeparam=utm_source
! example 4
$removeparam=~/regexp/
! example 5
@@||example.org^$removeparam
! example 6
@@||example.org^$removeparam=param
! example 7
@@||example.org^$removeparam=/regexp/
! example 8
$removeparam=/^(utm_source|utm_medium|utm_term)=/
! example 9
$removeparam=/^(utm_content|utm_campaign|utm_referrer)=/
! example 10
! <br/>
! Group of similar remove param rules will be combined into one
||testcases.adguard.com$xmlhttprequest,removeparam=p1case1
||testcases.adguard.com$xmlhttprequest,removeparam=p2case1
||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1
$xmlhttprequest,removeparam=p1case2

! ## $replace
! <b>Status</b>: not supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1
||example.org^$replace=/(<VAST[\s\S]*?>)[\s\S]*<\/VAST>/\$1<\/VAST>/i
! example 2
||example.org^$replace=/X/Y/
! example 3
||example.org^$replace=/Z/Y/
! example 4
@@||example.org/page/*$replace=/Z/Y/

! ## noop
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
||example.com$_,removeparam=/^ss\\$/,_,image
||example.com$domain=example.org,___,~third-party

! ## $empty
! <b>Status</b>: supported
! <br/>
! <b>Examples:</b>
! <br/>
! example 1.
||example.org^$empty

! ## $mp4
! <b>Status</b>: supported, deprecated
! <br/>
! <b>Examples:</b>
! <br/>
! example 1.
||example.com/videos/$mp4

! # Not supported in extension

! ## $hls (not supported in extension)
! ## $jsonprune (not supported in extension)
! ## $network (not supported in extension)
! ## $app (not supported in extension)
! ## $extension (not supported in extension)
