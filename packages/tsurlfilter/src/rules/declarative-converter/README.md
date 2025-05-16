# Table of contents
1. [Description](#description)
1. [MV3 specific limitations](#mv3_specific_limitations)
    1. [$badfilter](#mv3_specific_limitations__$badfilter)
        1. [Problem 1](#mv3_specific_limitations__$badfilter__problem_1)
        1. [Problem 2](#mv3_specific_limitations__$badfilter__problem_2)
    1. [allowrules](#mv3_specific_limitations__allowrules)
    1. [$document](#mv3_specific_limitations__$document)
    1. [$removeparam, $removeheader, $csp](#mv3_specific_limitations__$removeparam__$removeheader__$csp)
    1. [$redirect-rule](#mv3_specific_limitations__$redirect-rule)
1. [Basic examples](#basic_examples)
1. [Basic modifiers](#basic_modifiers)
    1. [$denyallow](#basic_modifiers__$denyallow)
    1. [$domain](#basic_modifiers__$domain)
    1. [$header](#basic_modifiers__$header)
    1. [$important](#basic_modifiers__$important)
    1. [$match-case](#basic_modifiers__$match-case)
    1. [$method](#basic_modifiers__$method)
    1. [$popup](#basic_modifiers__$popup)
    1. [$third-party](#basic_modifiers__$third-party)
    1. [$to](#basic_modifiers__$to)
1. [Content type modifiers](#content_type_modifiers)
    1. [$document](#content_type_modifiers__$document)
    1. [$image](#content_type_modifiers__$image)
    1. [$stylesheet](#content_type_modifiers__$stylesheet)
    1. [$script](#content_type_modifiers__$script)
    1. [$object](#content_type_modifiers__$object)
    1. [$font](#content_type_modifiers__$font)
    1. [$media](#content_type_modifiers__$media)
    1. [$subdocument](#content_type_modifiers__$subdocument)
    1. [$ping](#content_type_modifiers__$ping)
    1. [$xmlhttprequest](#content_type_modifiers__$xmlhttprequest)
    1. [$websocket](#content_type_modifiers__$websocket)
    1. [$webrtc](#content_type_modifiers__$webrtc)
    1. [$other](#content_type_modifiers__$other)
1. [Exception rules modifiers](#exception_rules_modifiers)
    1. [$content](#exception_rules_modifiers__$content)
    1. [$elemhide](#exception_rules_modifiers__$elemhide)
    1. [$jsinject](#exception_rules_modifiers__$jsinject)
    1. [$stealth](#exception_rules_modifiers__$stealth)
    1. [$urlblock](#exception_rules_modifiers__$urlblock)
    1. [$genericblock](#exception_rules_modifiers__$genericblock)
    1. [$generichide](#exception_rules_modifiers__$generichide)
    1. [$specifichide](#exception_rules_modifiers__$specifichide)
1. [Advanced capabilities](#advanced_capabilities)
    1. [$all](#advanced_capabilities__$all)
    1. [$badfilter](#advanced_capabilities__$badfilter)
    1. [$cookie](#advanced_capabilities__$cookie)
    1. [$csp](#advanced_capabilities__$csp)
    1. [$permissions](#advanced_capabilities__$permissions)
    1. [$redirect](#advanced_capabilities__$redirect)
    1. [$redirect-rule](#advanced_capabilities__$redirect-rule)
    1. [$referrerpolicy](#advanced_capabilities__$referrerpolicy)
    1. [$removeheader](#advanced_capabilities__$removeheader)
    1. [$removeparam](#advanced_capabilities__$removeparam)
    1. [$replace](#advanced_capabilities__$replace)
    1. [noop](#advanced_capabilities__noop)
    1. [$empty](#advanced_capabilities__$empty)
    1. [$mp4](#advanced_capabilities__$mp4)
1. [Not supported in extension](#not_supported_in_extension)
    1. [$hls (not supported in extension)](#not_supported_in_extension__$hls_(not_supported_in_extension))
    1. [$jsonprune (not supported in extension)](#not_supported_in_extension__$jsonprune_(not_supported_in_extension))
    1. [$network (not supported in extension)](#not_supported_in_extension__$network_(not_supported_in_extension))
    1. [$app (not supported in extension)](#not_supported_in_extension__$app_(not_supported_in_extension))
    1. [$extension (not supported in extension)](#not_supported_in_extension__$extension_(not_supported_in_extension))
<a name="description"></a>
# Description
This file contains examples of converting filter rules to new MV3 declarative
rules and describes some MV3-specific limitations of the converted rules.
For a full description of each modifier, see the knowledgebase https://adguard.com/kb/general/ad-filtering/create-own-filters.
<br />
<br />

<a name="mv3_specific_limitations"></a>
# MV3 specific limitations
<a name="mv3_specific_limitations__$badfilter"></a>
## $badfilter
In current implementation rules with `$badfilter` works across all filters.
From these three filters:
```adblock
!filter 1
||example.org^
```
```adblock
!filter 2
||example.com^
||example.com^$badfilter
||example.org^$badfilter
||persistent.com^
```
```adblock
!filter3
||example.org^$badfilter
```

Output result will contain only one rule:
```json
{
  "id": "<ruleId>",
  "action": {"type": "block"},
  "condition": {
    "urlFilter": "||persistent.com^",
    "isUrlFilterCaseSensitive": "false"
  },
  "priority": "1"
}
```

<b> Please note </b> that in the current approach, the application of
`$badfilter` rules affects the filtering process, but we do not currently
display this in the declarative filtering log, as declarative rules are canceled.

<a name="mv3_specific_limitations__$badfilter__problem_1"></a>
### Problem 1
But current algorithm not covers rules with `$domain` instersections, for example,
for these two rules:
```adblock
/some$domain=example.com|example.org
/some$domain=example.com,badfilter
```
rule with `$badfilter` will fully negated first rule and output array of
declarative rules will be empty.

<a name="mv3_specific_limitations__$badfilter__problem_2"></a>
### Problem 2
Also, sometimes, several raw rules combined into one declarative rules, for example:
```adblock
||testcases.adguard.com$xmlhttprequest,removeparam=p1case1
||testcases.adguard.com$xmlhttprequest,removeparam=p2case1
```
↓↓↓↓ converted to ↓↓↓↓
```json
{
  "id": 1,
  "action": {
    "type": "redirect",
    "redirect": {
      "transform": {"queryTransform": {"removeParams": ["p1case1", "p2case1"]}}
    }
  },
  "condition": {
    "urlFilter": "||testcases.adguard.com",
    "resourceTypes": ["xmlhttprequest"],
    "isUrlFilterCaseSensitive": false
  },
  "priority": 101
}
```
If we add rule `||testcases.adguard.com$xmlhttprequest,removeparam=p2case1,badfilter`
it will cancel not only one raw rule and regerate declarative, but cancel full
(combined from two raw rules) declarative rule:
```adblock
!filter 1
||testcases.adguard.com$xmlhttprequest,removeparam=p1case1
||testcases.adguard.com$xmlhttprequest,removeparam=p2case1
```
```adblock
!filter 2
||testcases.adguard.com$xmlhttprequest,removeparam=p1case1,badfilter
```
↓↓↓↓ converted to ↓↓↓↓
```json
{ }
```

<a name="mv3_specific_limitations__allowrules"></a>
## allowrules
Allowrules currently are not supported for these modifiers:
1. some specific exceptions: `$genericblock`, `$jsinject`, `$urlblock`, `$content`, `$stealth`.
1. `$redirect`
1. `$removeparam`
1. `$removeheader`
1. `$csp`

<a name="mv3_specific_limitations__$document"></a>
## $document
During convertion process exception with $document modificator is expanded
into `$elemhide,content,urlblock,jsinject` of which:
- `$content` - not supported in the MV3,
- `$elemhide` - supported,
- `$jsinject` - not implemented yet,
- `$urlblock` - not implemented yet.

So we still convert rules with `$document`, but only part with `$elemhide`
will be applied.

<a name="mv3_specific_limitations__$removeparam__$removeheader__$csp"></a>
## $removeparam, $removeheader, $csp
Rules with `$removeparam` or `$removeheader` or `$csp` which contains the same
conditions are combined into one rule only within one filter but not across
different filters. Because of that, rules from different filter can conflict.

<a name="mv3_specific_limitations__$redirect-rule"></a>
## $redirect-rule
Not supported. Awaiting implementation: https://github.com/w3c/webextensions/issues/493.
<br />
<br />

<a name="basic_examples"></a>
# Basic examples
Blocking by domain name

```adblock
||example.org^
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1164887431,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 1
  }
]

```
Blocking exact address

```adblock
|http://example.org/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 235727752,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "|http://example.org/"
    },
    "priority": 1
  }
]

```
Basic rule modifiers

```adblock
||example.org^$script,third-party,domain=example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1713517238,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "domainType": "thirdParty",
      "initiatorDomains": [
        "example.com"
      ],
      "resourceTypes": [
        "script"
      ]
    },
    "priority": 302
  }
]

```
Unblocking an address

```adblock
@@||example.org/banner
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 392632258,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||example.org/banner"
    },
    "priority": 100001
  }
]

```
Unblocking everything on a website

```adblock
@@||example.org^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1371086540,
    "action": {
      "type": "allowAllRequests"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 140101
  }
]

```
Cosmetic rule will be ignored

```adblock
example.org##.banner
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<br />
<br />

<a name="basic_modifiers"></a>
# Basic modifiers
<a name="basic_modifiers__$denyallow"></a>
## $denyallow
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>

```adblock
*$script,domain=a.com|b.com,denyallow=x.com|y.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 784875753,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "*",
      "initiatorDomains": [
        "a.com",
        "b.com"
      ],
      "excludedRequestDomains": [
        "x.com",
        "y.com"
      ],
      "resourceTypes": [
        "script"
      ]
    },
    "priority": 252
  }
]

```
<a name="basic_modifiers__$domain"></a>
## $domain
<b>Status</b>: partial supported
<br/>
<b>MV3 limitations:</b>
<br/>
Doesn't support regexps and any tld domains
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||baddomain.com^$domain=example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 84369718,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||baddomain.com^",
      "initiatorDomains": [
        "example.org"
      ]
    },
    "priority": 201
  }
]

```
example 2

```adblock
||baddomain.com^$domain=example.org|example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1472686061,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||baddomain.com^",
      "initiatorDomains": [
        "example.org",
        "example.com"
      ]
    },
    "priority": 151
  }
]

```
example 3

```adblock
||baddomain.com^$domain=~example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1028264072,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||baddomain.com^",
      "excludedInitiatorDomains": [
        "example.org"
      ]
    },
    "priority": 2
  }
]

```
example 4

```adblock
||baddomain.com^$domain=example.org|~foo.example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1726519168,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||baddomain.com^",
      "initiatorDomains": [
        "example.org"
      ],
      "excludedInitiatorDomains": [
        "foo.example.org"
      ]
    },
    "priority": 202
  }
]

```
example 5

```adblock
||baddomain.com^$domain=/(^\\|.+\\.)example\\.(com\\|org)\\$/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 6

```adblock
||baddomain.com^$domain=~a.com|~b.*|~/(^\\|.+\\.)c\\.(com\\|org)\\$/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2005983163,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||baddomain.com^",
      "excludedInitiatorDomains": [
        "a.com",
        "b.*",
        "/(^\\|.+\\\\.)c\\\\.(com\\\\|org)\\\\$/"
      ]
    },
    "priority": 2
  }
]

```
example 7

```adblock
*$cookie,domain=example.org|example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1907909817,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "remove",
          "header": "Set-Cookie"
        }
      ],
      "requestHeaders": [
        {
          "operation": "remove",
          "header": "Cookie"
        }
      ]
    },
    "condition": {
      "urlFilter": "*",
      "initiatorDomains": [
        "example.org",
        "example.com"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 151
  }
]

```
example 8

```adblock
*$document,domain=example.org|example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 501213106,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "*",
      "initiatorDomains": [
        "example.org",
        "example.com"
      ],
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 251
  }
]

```
example 9

```adblock
page$domain=example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 333660819,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "page",
      "initiatorDomains": [
        "example.org"
      ]
    },
    "priority": 201
  }
]

```
example 10

```adblock
page$domain=targetdomain.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1796222577,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "page",
      "initiatorDomains": [
        "targetdomain.com"
      ]
    },
    "priority": 201
  }
]

```
example 11

```adblock
||*page$domain=targetdomain.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 174286971,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "*page",
      "initiatorDomains": [
        "targetdomain.com"
      ]
    },
    "priority": 201
  }
]

```
example 12

```adblock
||*page$domain=targetdomain.com,cookie
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2074667603,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "remove",
          "header": "Set-Cookie"
        }
      ],
      "requestHeaders": [
        {
          "operation": "remove",
          "header": "Cookie"
        }
      ]
    },
    "condition": {
      "urlFilter": "*page",
      "initiatorDomains": [
        "targetdomain.com"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 201
  }
]

```
example 13

```adblock
/banner\d+/$domain=targetdomain.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 14

```adblock
page$domain=targetdomain.com|~example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1227814031,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "page",
      "initiatorDomains": [
        "targetdomain.com"
      ],
      "excludedInitiatorDomains": [
        "example.org"
      ]
    },
    "priority": 202
  }
]

```
<a name="basic_modifiers__$header"></a>
## $header
<b>Status</b>: not supported
<br/>
<b>MV3 limitations:</b>
<br/>
Cannot be converted to MV3 Declarative Rule
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.com^$header=set-cookie:foo
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
||example.com^$header=set-cookie
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
@@||example.com^$header=set-cookie:/foo\, bar\$/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
@@||example.com^$header=set-cookie
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="basic_modifiers__$important"></a>
## $important
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>
example 1.
<br/>
blocking rule will block all requests despite of the exception rule

```adblock
||example.org^$important
@@||example.org^
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 511809861,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 1000001
  },
  {
    "id": 72917959,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 100001
  }
]

```
example 2.
<br/>
if the exception rule also has `$important` modifier it will prevail,
so no requests will not be blocked

```adblock
||example.org^$important
@@||example.org^$important
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 511809861,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 1000001
  },
  {
    "id": 230819845,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 1100001
  }
]

```
example 3.
<br/>
if a document-level exception rule is applied to the document,
the `$important` modifier will be ignored;
so if a request to `example.org` is sent from the `test.org` domain,
the blocking rule will not be applied despite it has the `$important` modifier

```adblock
||example.org^$important
@@||test.org^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 511809861,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 1000001
  },
  {
    "id": 919249042,
    "action": {
      "type": "allowAllRequests"
    },
    "condition": {
      "urlFilter": "||test.org^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 140101
  }
]

```
<a name="basic_modifiers__$match-case"></a>
## $match-case
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>

```adblock
*/BannerAd.gif$match-case
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1110597017,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "*/BannerAd.gif",
      "isUrlFilterCaseSensitive": true
    },
    "priority": 2
  }
]

```
<a name="basic_modifiers__$method"></a>
## $method
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||evil.com^$method=get|head
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1114350918,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||evil.com^",
      "requestMethods": [
        "get",
        "head"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 76
  }
]

```
example 2

```adblock
||evil.com^$method=~post|~put
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1258462993,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||evil.com^",
      "excludedRequestMethods": [
        "post",
        "put"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 2
  }
]

```
example 3

```adblock
@@||evil.com$method=get
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2062111308,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||evil.com",
      "requestMethods": [
        "get"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 100101
  }
]

```
example 4

```adblock
@@||evil.com$method=~post
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1492162332,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||evil.com",
      "excludedRequestMethods": [
        "post"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 100002
  }
]

```
<a name="basic_modifiers__$popup"></a>
## $popup
<b>Status</b>: not implemented yet
<br/>
<b>MV3 limitations:</b>
<br/>
Cannot be converted to MV3 Declarative Rule, but maybe can be implemented on
the content-script side
<br/>
<b>Examples:</b>
<br/>

```adblock
||domain.com^$popup
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="basic_modifiers__$third-party"></a>
## $third-party
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||domain.com^$third-party
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1436362672,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||domain.com^",
      "domainType": "thirdParty"
    },
    "priority": 2
  }
]

```
example 2

```adblock
||domain.com$~third-party
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1913648592,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||domain.com",
      "domainType": "firstParty"
    },
    "priority": 2
  }
]

```
<a name="basic_modifiers__$to"></a>
## $to
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
/ads$to=evil.com|evil.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 620704825,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "/ads",
      "requestDomains": [
        "evil.com",
        "evil.org"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 2
  }
]

```
example 2

```adblock
/ads$to=~not.evil.com|evil.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 204054023,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "/ads",
      "requestDomains": [
        "evil.com"
      ],
      "excludedRequestDomains": [
        "not.evil.com"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 2
  }
]

```
example 3

```adblock
/ads$to=~good.com|~good.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 894146649,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "/ads",
      "excludedRequestDomains": [
        "good.com",
        "good.org"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 2
  }
]

```
<br />
<br />

<a name="content_type_modifiers"></a>
# Content type modifiers
<b>Status</b>: all content type modifiers supported, except deprecated $webrtc and $object-subrequest.
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org^$image
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2006907332,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "image"
      ]
    },
    "priority": 101
  }
]

```
example 2

```adblock
||example.org^$script,stylesheet
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 729333272,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "stylesheet",
        "script"
      ]
    },
    "priority": 76
  }
]

```
example 3

```adblock
||example.org^$~image,~script,~stylesheet
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2054755245,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "excludedResourceTypes": [
        "stylesheet",
        "script",
        "image",
        "main_frame"
      ]
    },
    "priority": 2
  }
]

```
<a name="content_type_modifiers__$document"></a>
## $document
example 1

```adblock
@@||example.com^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1493888951,
    "action": {
      "type": "allowAllRequests"
    },
    "condition": {
      "urlFilter": "||example.com^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 140101
  }
]

```
example 2

```adblock
@@||example.com^$document,~extension
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
||example.com^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1562061175,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.com^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 101
  }
]

```
example 4

```adblock
||example.com^$document,redirect=noopframe
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 216615167,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopframe.html"
      }
    },
    "condition": {
      "urlFilter": "||example.com^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 1101
  }
]

```
example 5

```adblock
||example.com^$document,removeparam=test
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 588584217,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "queryTransform": {
            "removeParams": [
              "test"
            ]
          }
        }
      }
    },
    "condition": {
      "urlFilter": "||example.com^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 101
  }
]

```
example 6

```adblock
||example.com^$document,replace=/test1/test2/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="content_type_modifiers__$image"></a>
## $image

```adblock
||example.org^$image
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2006907332,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "image"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$stylesheet"></a>
## $stylesheet

```adblock
||example.org^$stylesheet
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 991157915,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "stylesheet"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$script"></a>
## $script

```adblock
||example.org^$script
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1897769964,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "script"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$object"></a>
## $object

```adblock
||example.org^$object
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1733424982,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "object"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$font"></a>
## $font

```adblock
||example.org^$font
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 450886864,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "font"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$media"></a>
## $media

```adblock
||example.org^$media
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2011662663,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "media"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$subdocument"></a>
## $subdocument
example 1

```adblock
||example.com^$subdocument
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 542689075,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.com^",
      "resourceTypes": [
        "sub_frame"
      ]
    },
    "priority": 101
  }
]

```
example 2

```adblock
||example.com^$subdocument,domain=domain.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1411625229,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.com^",
      "initiatorDomains": [
        "domain.com"
      ],
      "resourceTypes": [
        "sub_frame"
      ]
    },
    "priority": 301
  }
]

```
<a name="content_type_modifiers__$ping"></a>
## $ping

```adblock
||example.org^$ping
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 451535635,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "ping"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$xmlhttprequest"></a>
## $xmlhttprequest

```adblock
||example.org^$xmlhttprequest
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 11366835,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "xmlhttprequest"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$websocket"></a>
## $websocket

```adblock
||example.org^$websocket
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 670909846,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "websocket"
      ]
    },
    "priority": 101
  }
]

```
<a name="content_type_modifiers__$webrtc"></a>
## $webrtc
<b>Status</b>: not supported
<br/>
example 1

```adblock
||example.com^$webrtc,domain=example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
@@*$webrtc,domain=example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="content_type_modifiers__$other"></a>
## $other

```adblock
||example.org^$other
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2005282727,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "other"
      ]
    },
    "priority": 101
  }
]

```
<br />
<br />

<a name="exception_rules_modifiers"></a>
# Exception rules modifiers
<a name="exception_rules_modifiers__$content"></a>
## $content
<b>Status</b>: not supported in MV3
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.com^$content
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$elemhide"></a>
## $elemhide
<b>Status</b>: supported but not converted.
<br/>
<b>MV3 limitations:</b>
<br/>
Not convertible to DNR in MV3, but in MV3 [tswebextension](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tswebextension) uses content-script to request cosmetic rules from tsurlfilter's with [MatchingResult.getCosmeticOption](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/engine/matching-result.ts#L235), where $elemhide, $specifichide and $generichide will be applied.
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.com^$elemhide
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$jsinject"></a>
## $jsinject
<b>Status</b>: not implemented yet
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.com^$jsinject
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$stealth"></a>
## $stealth
<b>Status</b>: not implemented yet
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
@@||example.com^$stealth
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
@@||domain.com^$script,stealth,domain=example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$urlblock"></a>
## $urlblock
<b>Status</b>: not implemented yet
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.com^$urlblock
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$genericblock"></a>
## $genericblock
<b>Status</b>: not implemented yet
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.com^$genericblock
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$generichide"></a>
## $generichide
<b>Status</b>: supported but not converted.
<br/>
<b>MV3 limitations:</b>
<br/>
Not convertible to DNR in MV3, but in MV3 [tswebextension](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tswebextension) uses content-script to request cosmetic rules from tsurlfilter's with [MatchingResult.getCosmeticOption](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/engine/matching-result.ts#L235), where $elemhide, $specifichide and $generichide will be applied.
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.com^$generichide
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="exception_rules_modifiers__$specifichide"></a>
## $specifichide
<b>Status</b>: supported but not converted.
<br/>
<b>MV3 limitations:</b>
<br/>
Not convertible to DNR in MV3, but in MV3 [tswebextension](https://github.com/AdguardTeam/tsurlfilter/tree/master/packages/tswebextension) uses content-script to request cosmetic rules from tsurlfilter's with [MatchingResult.getCosmeticOption](https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/src/engine/matching-result.ts#L235), where $elemhide, $specifichide and $generichide will be applied.
<br/>
<b>Examples:</b>
<br/>

```adblock
@@||example.org^$specifichide
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<br />
<br />

<a name="advanced_capabilities"></a>
# Advanced capabilities
<a name="advanced_capabilities__$all"></a>
## $all
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>

```adblock
||example.org^$all
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1119946050,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 55
  }
]

```
<a name="advanced_capabilities__$badfilter"></a>
## $badfilter
<b>Status</b>: partial support
<br/>
<b>MV3 limitations:</b>
<br/>
In current implementation it works across all filters, but it not covers
rules with $domain instersections.
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.com
||example.com$badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
||example.com,image
||example.com$image,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1679924937,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.com,image"
    },
    "priority": 1
  }
]

```
example 3

```adblock
@@||example.com
@@||example.com$badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
||example.com$domain=domain.com
||example.com$domain=domain.com,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 5

```adblock
/some$domain=example.com|example.org|example.io
/some$domain=example.com,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 6

```adblock
/some$domain=example.com|example.org|example.io
/some$domain=example.com|example.org,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 7

```adblock
/some$domain=example.com|example.org
/some$domain=example.com|example.org|example.io,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 8

```adblock
/some$domain=example.com|example.org|example.io
/some$domain=example.*,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1019790748,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "/some",
      "initiatorDomains": [
        "example.com",
        "example.org",
        "example.io"
      ]
    },
    "priority": 135
  }
]

```
example 9

```adblock
/some$domain=example.*
/some$domain=example.com|example.org,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 10

```adblock
/some$domain=example.com|example.org|example.io
/some$domain=example.com|~example.org,badfilter
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1019790748,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "/some",
      "initiatorDomains": [
        "example.com",
        "example.org",
        "example.io"
      ]
    },
    "priority": 135
  }
]

```
<a name="advanced_capabilities__$cookie"></a>
## $cookie
<b>Status</b>: supported
<br/>
<b>MV3 limitations:</b>
<br/>
The use of additional parameters in $cookie (apart from $cookie itself) is not supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org^$cookie=NAME;maxAge=3600;sameSite=lax
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
||example.org^$cookie
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1285736871,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "remove",
          "header": "Set-Cookie"
        }
      ],
      "requestHeaders": [
        {
          "operation": "remove",
          "header": "Cookie"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 3

```adblock
||example.org^$cookie=NAME
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
||example.org^$cookie=/regexp/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 5

```adblock
@@||example.org^$cookie
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 6

```adblock
@@||example.org^$cookie=NAME
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 7

```adblock
@@||example.org^$cookie=/regexp/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 8

```adblock
$cookie=__cfduid
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 9

```adblock
$cookie=/__utm[a-z]/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 10

```adblock
||facebook.com^$third-party,cookie=c_user
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="advanced_capabilities__$csp"></a>
## $csp
<b>Status</b>: supported
<br/>
<b>MV3 limitations:</b>
<br/>
Allowlist rules are not supported
<br/>
Rules with the same matching condition are combined into one, but only within
the scope of one static filter or within the scope of all dynamic rules
(custom filters and user rules).
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org^$csp=frame-src 'none'
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1383463238,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Content-Security-Policy",
          "value": "frame-src 'none'"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 2

```adblock
@@||example.org/page/*$csp=frame-src 'none'
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
@@||example.org/page/*$csp
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
||example.org^$csp=script-src 'self' 'unsafe-eval' http: https:
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1615117704,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Content-Security-Policy",
          "value": "script-src 'self' 'unsafe-eval' http: https:"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 5

```adblock
||example.org^$csp=script-src 'self' 'unsafe-eval' http: https:
@@||example.org^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1371086540,
    "action": {
      "type": "allowAllRequests"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 140101
  },
  {
    "id": 1615117704,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Content-Security-Policy",
          "value": "script-src 'self' 'unsafe-eval' http: https:"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
<a name="advanced_capabilities__$permissions"></a>
## $permissions
<b>Status</b>: supported
<br/>
<b>MV3 limitations:</b>
<br/>
Allowlist rules are not supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org^$permissions=sync-xhr=()
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1329901298,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Permissions-Policy",
          "value": "sync-xhr=()"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 1
  }
]

```
example 2

```adblock
@@||example.org/page/*$permissions=sync-xhr=()
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1263119637,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||example.org/page/*",
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 100001
  }
]

```
example 3

```adblock
@@||example.org/page/*$permissions
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1255367548,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "||example.org/page/*",
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 100001
  }
]

```
example 4

```adblock
$domain=example.org|example.com,permissions=oversized-images=()\, sync-script=()\, unsized-media=()
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 728168398,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Permissions-Policy",
          "value": "oversized-images=(), sync-script=(), unsized-media=()"
        }
      ]
    },
    "condition": {
      "initiatorDomains": [
        "example.org",
        "example.com"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 151
  }
]

```
example 5

```adblock
||example.org^$permissions=sync-xhr=()
@@||example.org^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1329901298,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Permissions-Policy",
          "value": "sync-xhr=()"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 1
  },
  {
    "id": 1371086540,
    "action": {
      "type": "allowAllRequests"
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame"
      ]
    },
    "priority": 140101
  }
]

```
<a name="advanced_capabilities__$redirect"></a>
## $redirect
<b>Status</b>: partial support
<br/>
<b>MV3 limitations:</b>
<br/>
Allowlist rules are not supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org/script.js$script,redirect=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1977140553,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopjs.js"
      }
    },
    "condition": {
      "urlFilter": "||example.org/script.js",
      "resourceTypes": [
        "script"
      ]
    },
    "priority": 1101
  }
]

```
example 2

```adblock
||example.org/test.mp4$media,redirect=noopmp4-1s
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 639704980,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopmp4.mp4"
      }
    },
    "condition": {
      "urlFilter": "||example.org/test.mp4",
      "resourceTypes": [
        "media"
      ]
    },
    "priority": 1101
  }
]

```
example 3

```adblock
@@||example.org^$redirect
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
@@||example.org^$redirect=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 5

```adblock
||*/redirect-test.css$redirect=noopcss
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 547549362,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopcss.css"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-test.css"
    },
    "priority": 1001
  }
]

```
example 6

```adblock
||*/redirect-test.js$redirect=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 921320818,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopjs.js"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-test.js"
    },
    "priority": 1001
  }
]

```
example 7

```adblock
||*/redirect-test.png$redirect=2x2-transparent.png
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1904749937,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/2x2-transparent.png"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-test.png"
    },
    "priority": 1001
  }
]

```
example 8

```adblock
||*/redirect-test.html$redirect=noopframe
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1481297074,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopframe.html"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-test.html"
    },
    "priority": 1001
  }
]

```
example 9

```adblock
||*/redirect-test.txt$redirect=nooptext
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 397468727,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/nooptext.js"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-test.txt"
    },
    "priority": 1001
  }
]

```
example 10

```adblock
||*/redirect-exception-test.js$redirect=noopjs
@@||*/redirect-exception-test.js
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1940385416,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopjs.js"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-exception-test.js"
    },
    "priority": 1001
  },
  {
    "id": 1682308684,
    "action": {
      "type": "allow"
    },
    "condition": {
      "urlFilter": "*/redirect-exception-test.js"
    },
    "priority": 100001
  }
]

```
example 11

```adblock
||*/redirect-priority-test.js$redirect=noopjs
||*/redirect-priority-test.js$important,csp=script-src 'self'
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 909168493,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopjs.js"
      }
    },
    "condition": {
      "urlFilter": "*/redirect-priority-test.js"
    },
    "priority": 1001
  },
  {
    "id": 1816110182,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "operation": "append",
          "header": "Content-Security-Policy",
          "value": "script-src 'self'"
        }
      ]
    },
    "condition": {
      "urlFilter": "*/redirect-priority-test.js",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1000001
  }
]

```
<a name="advanced_capabilities__$redirect-rule"></a>
## $redirect-rule
<b>Status</b>: not supported
Awaiting implementation: https://github.com/w3c/webextensions/issues/493.
<br/>
<b>Examples:</b>
<br/>

```adblock
||example.org/script.js
||example.org^$redirect-rule=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1511559822,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.org/script.js"
    },
    "priority": 1
  }
]

```
<a name="advanced_capabilities__$referrerpolicy"></a>
## $referrerpolicy
<b>Status</b>: not implemented yet
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.com^$referrerpolicy=unsafe-urlblock
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
@@||example.com^$referrerpolicy=unsafe-urlblock
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
@@||example.com/abcd.html^$referrerpolicy
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="advanced_capabilities__$removeheader"></a>
## $removeheader
<b>Status</b>: supported
<br/>
<b>MV3 limitations:</b>
<br/>
Allowlist rules are not supported
<br/>
Rules with the same matching condition are combined into one, but only within
the scope of one static filter or within the scope of all dynamic rules
(custom filters and user rules).
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org^$removeheader=header-name
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 156699538,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "header-name",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 2

```adblock
||example.org^$removeheader=request:header-name
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1145446713,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "header-name",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 3

```adblock
@@||example.org^$removeheader
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4 (with limitations)

```adblock
@@||example.org^$removeheader=header
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 5

```adblock
||example.org^$removeheader=refresh
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1625113114,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "refresh",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 6

```adblock
||example.org^$removeheader=request:x-client-data
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 747526909,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "x-client-data",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 1
  }
]

```
example 8

```adblock
$removeheader=location,domain=example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1145064334,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        {
          "header": "location",
          "operation": "remove"
        }
      ]
    },
    "condition": {
      "initiatorDomains": [
        "example.com"
      ],
      "resourceTypes": [
        "main_frame",
        "sub_frame",
        "stylesheet",
        "script",
        "image",
        "font",
        "object",
        "xmlhttprequest",
        "ping",
        "media",
        "websocket",
        "other"
      ]
    },
    "priority": 201
  }
]

```
<a name="advanced_capabilities__$removeparam"></a>
## $removeparam
<b>Status</b>: partial supported
<br/>
<b>MV3 limitations:</b>
<br/>
Allowlist rules are not supported
<br/>
Regexps, negation and allow-rules are not supported
<br/>
Rules with the same matching condition are combined into one, but only within
the scope of one static filter or within the scope of all dynamic rules
(custom filters and user rules).
<br/>
<b>Examples:</b>
<br/>
example 1.
skip rules with a negation, or regexp or the rule is a allowlist

```adblock
||example.org^$removeparam
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2131736874,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "query": ""
        }
      }
    },
    "condition": {
      "urlFilter": "||example.org^",
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 1
  }
]

```
example 2

```adblock
$removeparam=~param
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
$removeparam=utm_source
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1143364123,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "queryTransform": {
            "removeParams": [
              "utm_source"
            ]
          }
        }
      }
    },
    "condition": {
      "resourceTypes": [
        "main_frame",
        "sub_frame"
      ]
    },
    "priority": 1
  }
]

```
example 4

```adblock
$removeparam=~/regexp/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 5

```adblock
@@||example.org^$removeparam
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 6

```adblock
@@||example.org^$removeparam=param
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 7

```adblock
@@||example.org^$removeparam=/regexp/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 8

```adblock
$removeparam=/^(utm_source|utm_medium|utm_term)=/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 9

```adblock
$removeparam=/^(utm_content|utm_campaign|utm_referrer)=/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 10
<br/>
Group of similar remove param rules will be combined into one

```adblock
||testcases.adguard.com$xmlhttprequest,removeparam=p1case1
||testcases.adguard.com$xmlhttprequest,removeparam=p2case1
||testcases.adguard.com$xmlhttprequest,removeparam=P3Case1
$xmlhttprequest,removeparam=p1case2
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 2009110781,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "queryTransform": {
            "removeParams": [
              "p1case1",
              "p2case1",
              "P3Case1"
            ]
          }
        }
      }
    },
    "condition": {
      "urlFilter": "||testcases.adguard.com",
      "resourceTypes": [
        "xmlhttprequest"
      ]
    },
    "priority": 101
  },
  {
    "id": 1784990990,
    "action": {
      "type": "redirect",
      "redirect": {
        "transform": {
          "queryTransform": {
            "removeParams": [
              "p1case2"
            ]
          }
        }
      }
    },
    "condition": {
      "resourceTypes": [
        "xmlhttprequest"
      ]
    },
    "priority": 101
  }
]

```
<a name="advanced_capabilities__$replace"></a>
## $replace
<b>Status</b>: not supported
<br/>
<b>Examples:</b>
<br/>
example 1

```adblock
||example.org^$replace=/(<VAST[\s\S]*?>)[\s\S]*<\/VAST>/\$1<\/VAST>/i
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
||example.org^$replace=/X/Y/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
||example.org^$replace=/Z/Y/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
@@||example.org/page/*$replace=/Z/Y/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="advanced_capabilities__noop"></a>
## noop
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>

```adblock
||example.com$_,removeparam=/^ss\\$/,_,image
||example.com$domain=example.org,___,~third-party
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 1961107654,
    "action": {
      "type": "block"
    },
    "condition": {
      "urlFilter": "||example.com",
      "domainType": "firstParty",
      "initiatorDomains": [
        "example.org"
      ]
    },
    "priority": 202
  }
]

```
<a name="advanced_capabilities__$empty"></a>
## $empty
<b>Status</b>: supported
<br/>
<b>Examples:</b>
<br/>
example 1.

```adblock
||example.org^$empty
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 594281287,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/nooptext.js"
      }
    },
    "condition": {
      "urlFilter": "||example.org^"
    },
    "priority": 1001
  }
]

```
<a name="advanced_capabilities__$mp4"></a>
## $mp4
<b>Status</b>: supported, deprecated
<br/>
<b>Examples:</b>
<br/>
example 1.

```adblock
||example.com/videos/$mp4
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
  {
    "id": 351327571,
    "action": {
      "type": "redirect",
      "redirect": {
        "extensionPath": "/path/to/resources/noopmp4.mp4"
      }
    },
    "condition": {
      "urlFilter": "||example.com/videos/",
      "resourceTypes": [
        "media"
      ]
    },
    "priority": 1101
  }
]

```
<a name="not_supported_in_extension"></a>
# Not supported in extension
<a name="not_supported_in_extension__$hls_(not_supported_in_extension)"></a>
## $hls (not supported in extension)
<a name="not_supported_in_extension__$jsonprune_(not_supported_in_extension)"></a>
## $jsonprune (not supported in extension)
<a name="not_supported_in_extension__$network_(not_supported_in_extension)"></a>
## $network (not supported in extension)
<a name="not_supported_in_extension__$app_(not_supported_in_extension)"></a>
## $app (not supported in extension)
<a name="not_supported_in_extension__$extension_(not_supported_in_extension)"></a>
## $extension (not supported in extension)