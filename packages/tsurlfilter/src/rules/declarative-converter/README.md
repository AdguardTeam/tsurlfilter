# Table of contents
1. [Description](#description)
1. [Specific limitations](#specific_limitations)
    1. [$document](#$document)
    1. [$all](#$all)
    1. [$removeparam](#$removeparam)
    1. [$redirect-rule](#$redirect-rule)
1. [Basic examples](#basic_examples)
1. [Basic modifiers](#basic_modifiers)
    1. [$domain](#$domain)
    1. [$third-party](#$third-party)
    1. [$popup](#$popup)
    1. [$match-case](#$match-case)
    1. [$header](#$header)
1. [Content type modifiers](#content_type_modifiers)
    1. [$document](#$document)
    1. [$image](#$image)
    1. [$stylesheet](#$stylesheet)
    1. [$script](#$script)
    1. [$object](#$object)
    1. [$font](#$font)
    1. [$media](#$media)
    1. [$subdocument](#$subdocument)
    1. [$ping](#$ping)
    1. [$xmlhttprequest](#$xmlhttprequest)
    1. [$websocket](#$websocket)
    1. [$webrtc](#$webrtc)
1. [Exception rules modifiers](#exception_rules_modifiers)
    1. [$content](#$content)
    1. [$urlblock](#$urlblock)
    1. [$genericblock](#$genericblock)
    1. [$specifichide](#$specifichide)
    1. [Not supported in MV3](#not_supported_in_mv3)
        1. [$elemhide (not supported in MV3)](#$elemhide_(not_supported_in_mv3))
        1. [$jsinject (not supported in MV3)](#$jsinject_(not_supported_in_mv3))
        1. [$stealth (not supported in MV3)](#$stealth_(not_supported_in_mv3))
        1. [$generichide (not supported in MV3)](#$generichide_(not_supported_in_mv3))
1. [Advanced capabilities](#advanced_capabilities)
    1. [$important](#$important)
    1. [$badfilter](#$badfilter)
    1. [$redirect](#$redirect)
    1. [$redirect-rule (partial support)](#$redirect-rule_(partial_support))
    1. [$denyallow](#$denyallow)
    1. [$removeparam](#$removeparam)
    1. [Not supported in MV3](#not_supported_in_mv3)
        1. [$all (not supported in MV3)](#$all_(not_supported_in_mv3))
        1. [$removeheader (not supported in MV3)](#$removeheader_(not_supported_in_mv3))
        1. [$replace (not supported in MV3)](#$replace_(not_supported_in_mv3))
        1. [$csp (not supported in MV3)](#$csp_(not_supported_in_mv3))
        1. [$cookie (not supported in MV3)](#$cookie_(not_supported_in_mv3))
    1. [Not supported in extension](#not_supported_in_extension)
        1. [$hls (not supported in extension)](#$hls_(not_supported_in_extension))
        1. [$jsonprune (not supported in extension)](#$jsonprune_(not_supported_in_extension))
        1. [noop (not supported in extension)](#noop_(not_supported_in_extension))
        1. [$network (not supported in extension)](#$network_(not_supported_in_extension))
        1. [$app (not supported in extension)](#$app_(not_supported_in_extension))
<a name="description"></a>
# Description
This file contains examples of converting filter rules to new MV3 declarative
rules and describes some MV3-specific limitations of the converted rules.
<a name="specific_limitations"></a>
# Specific limitations
<a name="$document"></a>
## $document
Some general modifiers, like $document where the rule is expanded into
$elemhide, $content, $urlblock, $jsinject and $extension,
of which $elemhide and $jsinject are currently not supported,
but we still convert the document rules, but not completely.
[See code](./grouped-rules-converters/abstract-rule-converter.ts#432).

<a name="$all"></a>
## $all
To convert a $all rule, a network rule must be modified to accept multiple
modifiers from the same rule, for example, as it works with the
"multi"-modifier $document.

<a name="$removeparam"></a>
## $removeparam
Groups of $removeparam rules with the same conditions are combined into one
rule only within one filter.

<a name="$redirect-rule"></a>
## $redirect-rule
Works as $redirect
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "|http://example.org/",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.org/banner",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
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
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 4
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
<a name="basic_modifiers"></a>
# Basic modifiers
<a name="$domain"></a>
## $domain
example 1

```adblock
||baddomain.com^$domain=example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||baddomain.com^",
			"initiatorDomains": [
				"example.org"
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||baddomain.com^",
			"initiatorDomains": [
				"example.org",
				"example.com"
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||baddomain.com^",
			"excludedInitiatorDomains": [
				"example.org"
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 5

```adblock
||baddomain.com^$domain=/(^\\|.+\\.)example\\.(com\\|org)\\$/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||baddomain.com^",
			"initiatorDomains": [
				"/(^\\\\",
				".+\\\\.)example\\\\.(com\\\\",
				"org)\\\\$/"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 6

```adblock
||baddomain.com^$domain=~a.com|~b.*|~/(^\\|.+\\.)c\\.(com\\|org)\\$/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||baddomain.com^",
			"initiatorDomains": [
				".+\\\\.)c\\\\.(com\\\\",
				"org)\\\\$/"
			],
			"excludedInitiatorDomains": [
				"a.com",
				"b.*",
				"/(^\\\\"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 7

```adblock
*$cookie,domain=example.org|example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 8

```adblock
*$document,domain=example.org|example.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "page",
			"initiatorDomains": [
				"example.org"
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "page",
			"initiatorDomains": [
				"targetdomain.com"
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "*page",
			"initiatorDomains": [
				"targetdomain.com"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 12

```adblock
||*page$domain=targetdomain.com,cookie
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 13

```adblock
/banner\d+/$domain=targetdomain.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"regexFilter": "/banner\\d+/",
			"initiatorDomains": [
				"targetdomain.com"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 14

```adblock
page$domain=targetdomain.com|~example.org
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$third-party"></a>
## $third-party
example 1

```adblock
||domain.com^$third-party
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||domain.com^",
			"domainType": "thirdParty",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||domain.com",
			"domainType": "firstParty",
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$popup"></a>
## $popup
example 1

```adblock
||domain.com^$popup
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||domain.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$match-case"></a>
## $match-case
example 1

```adblock
*/BannerAd.gif$match-case
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "*/BannerAd.gif",
			"isUrlFilterCaseSensitive": true
		}
	}
]

```
<a name="$header"></a>
## $header
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
<a name="content_type_modifiers"></a>
# Content type modifiers
example 0

```adblock
||example.org^$image
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"image"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 1

```adblock
||example.org^$script,stylesheet
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"stylesheet",
				"script"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 2

```adblock
||example.org^$~image,~script,~stylesheet
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"excludedResourceTypes": [
				"stylesheet",
				"script",
				"image"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$document"></a>
## $document
example 0

```adblock
@@||example.com^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 4
	}
]

```
example 1

```adblock
@@||example.com^$document,~extension
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 4
	}
]

```
example 2

```adblock
||example.com^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 3

```adblock
||example.com^$document,redirect=noopframe
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 4

```adblock
||example.com^$document,removeparam=test
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 5

```adblock
||example.com^$document,replace=/test1/test2/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$image"></a>
## $image

```adblock
||example.org^$image
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"image"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$stylesheet"></a>
## $stylesheet

```adblock
||example.org^$stylesheet
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"stylesheet"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$script"></a>
## $script

```adblock
||example.org^$script
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"script"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$object"></a>
## $object

```adblock
||example.org^$object
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"object"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$font"></a>
## $font

```adblock
||example.org^$font
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"font"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$media"></a>
## $media

```adblock
||example.org^$media
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"media"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$subdocument"></a>
## $subdocument
example 1

```adblock
||example.com^$subdocument
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"sub_frame"
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$ping"></a>
## $ping

```adblock
||example.org^$ping
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"ping"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$xmlhttprequest"></a>
## $xmlhttprequest

```adblock
||example.org^$ping
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"ping"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$websocket"></a>
## $websocket

```adblock
||example.org^$ping
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"ping"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$webrtc"></a>
## $webrtc
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
<a name="exception_rules_modifiers"></a>
# Exception rules modifiers
<a name="$content"></a>
## $content

```adblock
@@||example.com^$content
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
<a name="$urlblock"></a>
## $urlblock

```adblock
@@||example.com^$urlblock
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
<a name="$genericblock"></a>
## $genericblock

```adblock
@@||example.com^$genericblock
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.com^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
<a name="$specifichide"></a>
## $specifichide

```adblock
@@||example.org^$specifichide
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
<a name="not_supported_in_mv3"></a>
## Not supported in MV3
<a name="$elemhide_(not_supported_in_mv3)"></a>
### $elemhide (not supported in MV3)

```adblock
@@||example.com^$elemhide
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="$jsinject_(not_supported_in_mv3)"></a>
### $jsinject (not supported in MV3)

```adblock
@@||example.com^$jsinject
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="$stealth_(not_supported_in_mv3)"></a>
### $stealth (not supported in MV3)
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
<a name="$generichide_(not_supported_in_mv3)"></a>
### $generichide (not supported in MV3)

```adblock
@@||example.com^generichide
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.com^generichide",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
<a name="advanced_capabilities"></a>
# Advanced capabilities
<a name="$important"></a>
## $important
blocking rule will block all requests despite of the exception rule

```adblock
||example.org^$important
@@||example.org^
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 2
	},
	{
		"id": 2,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 2
	},
	{
		"id": 2,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 3
	}
]

```
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 2
	},
	{
		"id": 2,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||test.org^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 4
	}
]

```
<a name="$badfilter"></a>
## $badfilter
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.com,image",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "/some",
			"initiatorDomains": [
				"example.com",
				"example.org",
				"example.io"
			],
			"isUrlFilterCaseSensitive": false
		}
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
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "/some",
			"initiatorDomains": [
				"example.*"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "/some",
			"initiatorDomains": [
				"example.com",
				"example.org",
				"example.io"
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$redirect"></a>
## $redirect
example 1

```adblock
||example.org/script.js$script,redirect=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 3

```adblock
@@||example.org^$redirect
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/undefined"
			}
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
example 4

```adblock
@@||example.org^$redirect=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopjs.js"
			}
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
example 5

```adblock
||*/redirect-test.css$redirect=noopcss
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopcss.css"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-test.css",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopjs.js"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-test.js",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/2x2-transparent.png"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-test.png",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopframe.html"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-test.html",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/nooptext.js"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-test.txt",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopjs.js"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-exception-test.js",
			"isUrlFilterCaseSensitive": false
		}
	},
	{
		"id": 2,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "*/redirect-exception-test.js",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
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
		"id": 1,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopjs.js"
			}
		},
		"condition": {
			"urlFilter": "*/redirect-priority-test.js",
			"isUrlFilterCaseSensitive": false
		}
	},
	{
		"id": 2,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "*/redirect-priority-test.js",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 2
	}
]

```
<a name="$redirect-rule_(partial_support)"></a>
## $redirect-rule (partial support)

```adblock
||example.org/script.js
||example.org^$redirect-rule=noopjs
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org/script.js",
			"isUrlFilterCaseSensitive": false
		}
	},
	{
		"id": 2,
		"action": {
			"type": "redirect",
			"redirect": {
				"extensionPath": "/path/to/resources/noopjs.js"
			}
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$denyallow"></a>
## $denyallow

```adblock
*$script,domain=a.com|b.com,denyallow=x.com|y.com
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$removeparam"></a>
## $removeparam
skip rules with a negation, or regexp or the rule is a allowlist

example 1

```adblock
||example.org^$removeparam
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
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
			"isUrlFilterCaseSensitive": false
		}
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
$removeparam=~/regexp/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
@@||example.org^$removeparam
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 5

```adblock
@@||example.org^$removeparam=param
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 6

```adblock
@@||example.org^$removeparam=/regexp/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 7

```adblock
$removeparam=/^(utm_source|utm_medium|utm_term)=/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 8

```adblock
$removeparam=/^(utm_content|utm_campaign|utm_referrer)=/
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
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
		"id": 1,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	},
	{
		"id": 4,
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
			],
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="not_supported_in_mv3"></a>
## Not supported in MV3
<a name="$all_(not_supported_in_mv3)"></a>
### $all (not supported in MV3)

```adblock
||example.org^$all
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
<a name="$removeheader_(not_supported_in_mv3)"></a>
### $removeheader (not supported in MV3)
example 1

```adblock
||example.org^$removeheader=header-name
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		}
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
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 3

```adblock
@@||example.org^$removeheader
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
example 4

```adblock
@@||example.org^$removeheader=header
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allow"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		},
		"priority": 1
	}
]

```
example 5

```adblock
$removeheader
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 6

```adblock
||example.org^$removeheader=refresh
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
example 7

```adblock
||example.org^$removeheader=request:x-client-data
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="$replace_(not_supported_in_mv3)"></a>
### $replace (not supported in MV3)
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
<a name="$csp_(not_supported_in_mv3)"></a>
### $csp (not supported in MV3)
example 0

```adblock
||example.org^$csp=frame-src 'none'
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 1

```adblock
@@||example.org/page/*$csp=frame-src 'none'
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 2

```adblock
@@||example.org/page/*$csp
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 3

```adblock
||example.org^$csp=script-src 'self' 'unsafe-eval' http: https:
```

↓↓↓↓ converted to ↓↓↓↓

```json
[]

```
example 4

```adblock
@@||example.org^$document
```

↓↓↓↓ converted to ↓↓↓↓

```json
[
	{
		"id": 1,
		"action": {
			"type": "allowAllRequests"
		},
		"condition": {
			"urlFilter": "||example.org^",
			"resourceTypes": [
				"main_frame"
			],
			"isUrlFilterCaseSensitive": false
		},
		"priority": 4
	}
]

```
<a name="$cookie_(not_supported_in_mv3)"></a>
### $cookie (not supported in MV3)
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
[]

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
[
	{
		"id": 1,
		"action": {
			"type": "block"
		},
		"condition": {
			"urlFilter": "||facebook.com^",
			"domainType": "thirdParty",
			"isUrlFilterCaseSensitive": false
		}
	}
]

```
<a name="not_supported_in_extension"></a>
## Not supported in extension
<a name="$hls_(not_supported_in_extension)"></a>
### $hls (not supported in extension)
<a name="$jsonprune_(not_supported_in_extension)"></a>
### $jsonprune (not supported in extension)
<a name="noop_(not_supported_in_extension)"></a>
### noop (not supported in extension)
<a name="$network_(not_supported_in_extension)"></a>
### $network (not supported in extension)
<a name="$app_(not_supported_in_extension)"></a>
### $app (not supported in extension)