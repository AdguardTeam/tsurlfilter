export const max4 = 2n ** 32n - 1n;
export const max6 = 2n ** 128n - 1n;

export function parseIp(ip) {
  const version = ipVersion(ip);
  if (!version) throw new Error(`Invalid IP address: ${ip}`);

  let number = 0n;
  let exp = 0n;
  const res = Object.create(null);

  if (version === 4) {
    for (const n of ip.split(".").map(BigInt).reverse()) {
      number += n * (2n ** exp);
      exp += 8n;
    }
  } else {
    if (ip.includes(".")) {
      res.ipv4mapped = true;
      ip = ip.split(":").map(part => {
        if (part.includes(".")) {
          const digits = part.split(".").map(str => Number(str).toString(16).padStart(2, "0"));
          return `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}`;
        } else {
          return part;
        }
      }).join(":");
    }

    if (ip.includes("%")) {
      let scopeid;
      [, ip, scopeid] = /(.+)%(.+)/.exec(ip);
      res.scopeid = scopeid;
    }

    const parts = ip.split(":");
    const index = parts.indexOf("");

    if (index !== -1) {
      while (parts.length < 8) {
        parts.splice(index, 0, "");
      }
    }

    for (const n of parts.map(part => BigInt(parseInt(part || 0, 16))).reverse()) {
      number += n * (2n ** exp);
      exp += 16n;
    }
  }

  res.number = number;
  res.version = version;
  return res;
}

export function stringifyIp({number, version, ipv4mapped, scopeid} = {}, {compress = true, hexify = false} = {}) {
  if (typeof number !== "bigint") throw new Error(`Expected a BigInt`);
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);
  if (number < 0n || number > (version === 4 ? max4 : max6)) throw new Error(`Invalid number: ${number}`);

  let step = version === 4 ? 24n : 112n;
  const stepReduction = version === 4 ? 8n : 16n;
  let remain = number;
  const parts = [];

  while (step > 0n) {
    const divisor = 2n ** step;
    parts.push(remain / divisor);
    remain = number % divisor;
    step -= stepReduction;
  }
  parts.push(remain);

  if (version === 4) {
    return parts.join(".");
  } else {
    let ip = "";
    if (ipv4mapped && !hexify) {
      for (const [index, num] of parts.entries()) {
        if (index < 6) {
          ip += `${num.toString(16)}:`;
        } else {
          ip += `${String(num >> 8n)}.${String(num & 255n)}${index === 6 ? "." : ""}`;
        }
      }
      if (compress) {
        ip = compressIPv6(ip.split(":"));
      }
    } else {
      if (compress) {
        ip = compressIPv6(parts.map(n => n.toString(16)));
      } else {
        ip = parts.map(n => n.toString(16)).join(":");
      }
    }

    if (scopeid) {
      ip = `${ip}%${scopeid}`;
    }

    return ip;
  }
}

export function normalizeIp(ip, {compress = true, hexify = false} = {}) {
  return stringifyIp(parseIp(ip), {compress, hexify});
}

// take the longest or first sequence of "0" segments and replace it with "::"
function compressIPv6(parts) {
  let longest, current;
  for (const [index, part] of parts.entries()) {
    if (part === "0") {
      if (!current) {
        current = new Set([index]);
      } else {
        current.add(index);
      }
    } else {
      if (current) {
        if (!longest) {
          longest = current;
        } else if (current.size > longest.size) {
          longest = current;
        }
        current = null;
      }
    }
  }
  if ((!longest && current) || (current && current.size > longest.size)) {
    longest = current;
  }

  for (const index of longest || []) {
    parts[index] = ":";
  }

  return parts.filter(Boolean).join(":").replace(/:{2,}/, "::");
}

export function ipVersion(ip) {
  return ip.includes(":") ? 6 : ip.includes(".") ? 4 : 0;
}
