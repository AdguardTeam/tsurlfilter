! # Description
! This file contains examples of converting filter rules to new MV3 declarative
! rules and describes some MV3-specific limitations of the converted rules.

! # Specific limitations
! ## $document
! Some general modifiers, like $document where the rule is expanded into
! $elemhide, $content, $urlblock, $jsinject and $extension,
! of which $elemhide and $jsinject are currently not supported,
! but we still convert the document rules, but not completely.
! [See code](./grouped-rules-converters/abstract-rule-converter.ts#432).
!
! ## $all
! To convert a $all rule, a network rule must be modified to accept multiple
! modifiers from the same rule, for example, as it works with the
! "multi"-modifier $document.
!
! ## $removeparam
! Groups of $removeparam rules with the same conditions are combined into one
! rule only within one filter.
!
! ## $redirect-rule
! Works as $redirect

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

! # Basic modifiers

! ## $domain

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

! ## $third-party

! example 1
||domain.com^$third-party
! example 2
||domain.com$~third-party

! ## $popup

! example 1
||domain.com^$popup

! ## $match-case

! example 1
*/BannerAd.gif$match-case

! ## $header

! example 1
||example.com^$header=set-cookie:foo
! example 2
||example.com^$header=set-cookie
! example 3
@@||example.com^$header=set-cookie:/foo\, bar\$/
! example 4
@@||example.com^$header=set-cookie

! # Content type modifiers

! example 0
||example.org^$image
! example 1
||example.org^$script,stylesheet
! example 2
||example.org^$~image,~script,~stylesheet

! ## $document

! example 0
@@||example.com^$document
! example 1
@@||example.com^$document,~extension
! example 2
||example.com^$document
! example 3
||example.com^$document,redirect=noopframe
! example 4
||example.com^$document,removeparam=test
! example 5
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
||example.org^$ping

! ## $websocket
||example.org^$ping

! ## $webrtc

! example 1
||example.com^$webrtc,domain=example.org
! example 2
@@*$webrtc,domain=example.org

! # Exception rules modifiers

! ## $content
@@||example.com^$content

! ## $urlblock
@@||example.com^$urlblock

! ## $genericblock
@@||example.com^$genericblock

! ## $specifichide
@@||example.org^$specifichide

! ## Not supported in MV3

! ### $elemhide (not supported in MV3)
@@||example.com^$elemhide

! ### $jsinject (not supported in MV3)
@@||example.com^$jsinject

! ### $stealth (not supported in MV3)
! example 1
@@||example.com^$stealth
! example 2
@@||domain.com^$script,stealth,domain=example.com

! ### $generichide (not supported in MV3)
@@||example.com^generichide


! # Advanced capabilities

! ## $important

! blocking rule will block all requests despite of the exception rule
||example.org^$important
@@||example.org^

! if the exception rule also has `$important` modifier it will prevail,
! so no requests will not be blocked
||example.org^$important
@@||example.org^$important

! if a document-level exception rule is applied to the document,
! the `$important` modifier will be ignored;
! so if a request to `example.org` is sent from the `test.org` domain,
! the blocking rule will not be applied despite it has the `$important` modifier
||example.org^$important
@@||test.org^$document

! ## $badfilter

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

! ## $redirect
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

! ## $redirect-rule (partial support)
||example.org/script.js
||example.org^$redirect-rule=noopjs

! ## $denyallow
*$script,domain=a.com|b.com,denyallow=x.com|y.com

! ## $removeparam
! skip rules with a negation, or regexp or the rule is a allowlist
!
! example 1
||example.org^$removeparam
! example 2
$removeparam=~param
! example 3
$removeparam=~/regexp/
! example 4
@@||example.org^$removeparam
! example 5
@@||example.org^$removeparam=param
! example 6
@@||example.org^$removeparam=/regexp/
! example 7
$removeparam=/^(utm_source|utm_medium|utm_term)=/
! example 8
$removeparam=/^(utm_content|utm_campaign|utm_referrer)=/

! Group of similar remove param rules will be combined into one
||testcases.adguard.com$xmlhttprequest,removeparam=p1case1
||testcases.adguard.com$xmlhttprequest,removeparam=p2case1
||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1
$xmlhttprequest,removeparam=p1case2

! ## Not supported in MV3

! ### $all (not supported in MV3)
||example.org^$all

! ### $removeheader (not supported in MV3)

! example 1
||example.org^$removeheader=header-name
! example 2
||example.org^$removeheader=request:header-name
! example 3
@@||example.org^$removeheader
! example 4
@@||example.org^$removeheader=header
! example 5
$removeheader
! example 6
||example.org^$removeheader=refresh
! example 7
||example.org^$removeheader=request:x-client-data

! ### $replace (not supported in MV3)

! example 1
||example.org^$replace=/(<VAST[\s\S]*?>)[\s\S]*<\/VAST>/\$1<\/VAST>/i
! example 2
||example.org^$replace=/X/Y/
! example 3
||example.org^$replace=/Z/Y/
! example 4
@@||example.org/page/*$replace=/Z/Y/

! ### $csp (not supported in MV3)

! example 0
||example.org^$csp=frame-src 'none'
! example 1
@@||example.org/page/*$csp=frame-src 'none'
! example 2
@@||example.org/page/*$csp
! example 3
||example.org^$csp=script-src 'self' 'unsafe-eval' http: https:
! example 4
@@||example.org^$document

! ### $cookie (not supported in MV3)

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

! ## Not supported in extension

! ### $hls (not supported in extension)
! ### $jsonprune (not supported in extension)
! ### noop (not supported in extension)
! ### $network (not supported in extension)
! ### $app (not supported in extension)
