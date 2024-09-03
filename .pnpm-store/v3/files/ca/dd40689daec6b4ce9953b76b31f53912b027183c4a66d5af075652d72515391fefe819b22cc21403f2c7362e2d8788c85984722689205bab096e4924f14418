# ip6addr

ip6addr is a small library for manipulating IP addresses in JavaScript.
Inspired by [ipaddr.js](https://github.com/whitequark/ipaddr.js), ip6addr
focuses on better IPv6 support, particularly in cases where IPv4 and IPv6
addresses are used together.

If you want to also parse and manipulate MAC addresses, see
[macaddr](https://github.com/joyent/node-macaddr).

# Installation

    npm install ip6addr

# API

## `parse(input)`

Parse the input IP address, which can be either a string or an integer, and
return a representative [`Addr`](#class-addr). When the address is invalid,
an explanatory `Error` is thrown.

```javascript
> var addr1 = ip6addr.parse('fd00::0123')
> addr1.toString()
'fd00::123'
> var addr2 = ip6addr.parse('1.2.3.4')
> addr2.toString()
'1.2.3.4'
> var addr3 = ip6addr.parse('::ffff:127.0.0.1')
> addr3.toString()
'::ffff:127.0.0.1'
```

## `createCIDR(cidr, [plen])`

Either parse a string in CIDR notation, such as `'192.168.1.0/24'`, or, when
given an address and a prefix length, create the representative
[`CIDR`](#class-cidr). When it fails to parse, it throws an `Error`.

```javascript
> var sub1 = ip6addr.createCIDR('fe80::/10')
> sub1.toString()
'fe80::/10'
> var sub2 = ip6addr.createCIDR('fc00::', 7)
> sub2.toString()
'fc00::/7'
> var sub3 = ip6addr.createCIDR('10.0.0.0', 8)
> sub3.toString()
'10.0.0.0/8'
```

## `createAddrRange(first, last)`

Create an inclusive range of addresses from `first` address to `last` address,
represented by an [`AddrRange`](#class-addrrange). The `first` address must
come before or be the same as the `last` address.

```javascript
> var r1 = ip6addr.createAddrRange('fd00::123', 'fd00::ea00')
> r1.first().toString()
'fd00::123'
> r1.last().toString()
'fd00::ea00'
```

## <a name="func-compareaddr">`compare(addr1, addr2)`</a>

Compares one address with another, and returns:

- A negative number when `addr1` comes before `addr2`
- A positive number when `addr1` comes after `addr2`
- 0 when the two addresses are the same

IPv4 addresses are compared against IPv6 addresses in their IPv4-mapped form.

```javascript
> [ 'fc00::123', '192.168.1.50', '10.0.1.76', '8.8.8.8', '::1' ].sort(ip6addr.compare)
[ '::1',
  '8.8.8.8',
  '10.0.1.76',
  '192.168.1.50',
  'fc00::123' ]
```

## <a name="func-comparecidr">`compareCIDR(cidr1, cidr2)`</a>

Compares one subnet with another. Subnets are compared first by their address
component, and then by their prefix length. The network with the smaller prefix
length (the larger subnet) is considered greater than the network with the
larger prefix (the smaller subnet). Like [`compare()`](#func-compareaddr), this
method returns:

- A negative number when subnet `cidr1` comes before `cidr2`
- A positive number when subnet `cidr1` comes after `cidr2`
- 0 when the two subnets are the same

```javascript
> [ 'fc00::/7', '192.168.0.0/24', '192.168.0.0/16', '127.0.0.0/8', '::ffff:0.0.0.0/96' ].sort(ip6addr.compareCIDR)
[ '::ffff:0.0.0.0/96',
  '127.0.0.0/8',
  '192.168.0.0/24',
  '192.168.0.0/16',
  'fc00::/7' ]
```

## <a name="class-addr">`Addr`</a>

An immutable representation of an IP address.

### `Addr#kind()`

Returns the address family of the object, `ipv4` or `ipv6`.

```javascript
> ip6addr.parse('::1').kind()
'ipv6'
> ip6addr.parse('127.0.0.1').kind()
'ipv4'
> ip6addr.parse('::ffff:127.0.0.1').kind()
'ipv4'
```

### `Addr#toString([opts])`

Return the string representation of this address. An options object can be
passed to control how the address is formatted. Valid options are:

- `format` (default: `auto`), select the notation style to use when printing.
  Available options are:
  - `'auto'`, format using the notation style the address was parsed as
  - `'v4'`, format as an IPv4 address
  - `'v4-mapped'`, format as an IPv4-mapped IPv6 address
  - `'v6'`, format the string as IPv6 address

  Attempts to format an IPv6 address with `'v4'` or `'v4-mapped'` will throw an
  `Error`.
- `zeroElide` (default: `true`), whether to elide the longest run of zeros in
  IPv6 addresses as `::` (e.g., `'0:0:0:0:0:0:0:1'` becomes `'::1'`).
- `zeroPad` (default: `false`), if a field (also referred to as a "group" or
  "hextet") would print as less than four characters in an IPv6 address,
  whether or not to pad it with leading zeros (e.g., `'::1'` becomes `'::0001'`)

```javascript
> var addr = ip6addr.parse('::ffff:127.0.0.1')
> addr.toString({ format: 'auto' })
'::ffff:127.0.0.1'
> addr.toString({ format: 'v4' })
'127.0.0.1'
> addr.toString({ format: 'v4-mapped' })
'::ffff:127.0.0.1'
> addr.toString({ format: 'v6' })
'::ffff:7f00:1'
> addr.toString({ zeroElide: false })
'0:0:0:0:0:ffff:127.0.0.1'
> addr.toString({ zeroElide: false, zeroPad: true })
'0000:0000:0000:0000:0000:ffff:127.0.0.1'
```

### `Addr#toBuffer([buf])`

Convert the address to a buffer of sixteen 16-bit integers, representing the
IPv6 representation of this address. An alternate buffer to write to may be
passed in instead, rather than creating a new one.

### `Addr#toLong()`

Return the address represented as a 32-bit integer. If this address cannot be
represented as a 32-bit integer (i.e., it's an IPv6 address), then this method
will throw an Error.

```javascript
> var addr = ip6addr.parse('127.0.0.1')
> addr.toLong()
2130706433
```

### `Addr#offset(num)`

Calculate the offset by `num` from this address. If the offset would result
in wrap-around, then this method returns `null`.

```javascript
> var addr1 = ip6addr.parse('fd20::5')
> addr1.offset(1).toString()
'fd20::6'
> addr1.offset(-1).toString()
'fd20::4'
> addr1.offset(20).toString()
'fd20::19'
> addr1.offset(-20).toString()
'fd1f:ffff:ffff:ffff:ffff:ffff:ffff:fff1'
> ip6addr.parse('255.255.255.255').offset(1)
null
> ip6addr.parse('0.0.0.0').offset(-1)
null
> ip6addr.parse('::').offset(-1)
null
```

### `Addr#compare(other)`

Compare another address to this one in the same manner as
[`compare()`](#func-compareaddr).

## <a name="class-cidr">`CIDR`</a>

An immutable representation of a subnet.

### `CIDR#contains(input)`

Checks if this subnet contains the address `input`.

```javascript
> var sub = ip6addr.createCIDR('fe80::', 10)
> sub.contains('fe80::92b8:d0ff:fe81:f590')
true
> sub.contains('fe80::507f:baff:fe85:92eb')
true
> sub.contains('2001:4860:4860::8888')
false
> sub.contains('172.16.20.5')
false
> sub.contains('::ffff:127.0.0.1')
false
```

### `CIDR#first()`

Returns the first address in this subnet.

```javascript
> var sub = ip6addr.createCIDR('fe80::', 10)
> sub.first().toString()
'fe80::1'
```

### `CIDR#last()`

Returns the last address in this subnet. For IPv4 subnets, this is the address
just before the broadcast address.

```javascript
> var sub1 = ip6addr.createCIDR('fe80::', 10)
> sub1.last().toString()
'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
> var sub2 = ip6addr.createCIDR('192.168.1.0', 24)
> sub2.last().toString()
'192.168.1.254'
```

### `CIDR#broadcast()`

Returns the broadcast address for this subnet. If the subnet doesn't have a broadcast
address (i.e., it's an IPv6 subnet and therefore uses multicast), then this method
throws an Error.

```javascript
> var sub1 = ip6addr.createCIDR('192.168.1.0', 24)
> sub1.broadcast().toString()
'192.168.1.255'
> var sub2 = ip6addr.createCIDR('192.168.0.0', 16)
> sub2.broadcast().toString()
'192.168.255.255'
```

### `CIDR#compare(other)`

Compare another subnet to this one in the same manner as
[`compareCIDR()`](#func-comparecidr).

### `CIDR#prefixLength()`

Returns the prefix length of this subnet.

### `CIDR#address()`

Returns the address component of this subnet.

### `CIDR#toString([opts])`

Returns the string representation of this subnet. An options object can be
passed to control how the subnet is formatted, using the same options that
`Addr#toString()` takes.

## <a name="class-addrrange">`AddrRange`</a>

An immutable representation of a range of addresses.

### `AddrRange#contains(addr)`

Determines whether the input address falls within this address range.

```javascript
> var range = ip6addr.createAddrRange('fd00::123', 'fd00::ea00')
undefined
> range.contains('fd00::123')
true
> range.contains('fd00::ea00')
true
> range.contains('fd00::b000')
true
> range.contains('fd00::122')
false
> range.contains('fd00::ea01')
false
> range.contains('8.8.8.8')
false
```

### `AddrRange#first()`

Returns the first address in this range.

### `AddrRange#last()`

Returns the last address in this range.

# License

This Source Code Form is subject to the terms of the Mozilla Public License, v.
2.0.  For the full license text see LICENSE, or http://mozilla.org/MPL/2.0/.

Copyright (c) 2019, Joyent, Inc.
