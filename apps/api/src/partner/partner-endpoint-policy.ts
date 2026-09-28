import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

/**
 * DeliveryEndpoint の宛先統制(API-010 §2、security review finding H3、WP-6006 review F1/F2)。
 *
 * 1. `assertPublicHttpsEndpoint(url)` — 同期の文字列検査: https、既定ポート、credential なし、
 *    IP リテラル禁止、末尾ドットを剥がした上での禁止ホスト/接尾辞、public DNS 名。
 * 2. `assertResolvesToPublicAddress(url, lookup)` — DNS 解決結果の全アドレスが public であること。
 *    登録時と配送時の両方で呼ぶ(API-010 §2「DNS 再解決後も同条件」)。
 *
 * ponytail: 解決と fetch の間の rebinding 窓は残る(fetch は独自に再解決する)。
 * この窓は egress network 層(allow-list / proxy)で閉じる前提であり、その統制が
 * 未整備である事実は Plans.md §16 に BLOCKED_SECURITY_REVIEW として記録する。
 */
export class PartnerEndpointPolicyError extends RangeError {
  constructor(readonly reason: string) {
    super(`partner endpoint rejected: ${reason}`);
    this.name = 'PartnerEndpointPolicyError';
  }
}

export type AddressLookup = (hostname: string) => Promise<readonly { address: string; family: number }[]>;

export const defaultAddressLookup: AddressLookup = (hostname) =>
  dns.lookup(hostname, { all: true, verbatim: true });

const forbiddenHostSuffixes = ['.local', '.localhost', '.internal', '.arpa', '.home', '.lan'];
const forbiddenHosts = new Set(['localhost', 'metadata.google.internal']);

export function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  const [a, b] = parts;
  if (parts.length !== 4 || a === undefined || b === undefined) return true;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/**
 * IPv6 リテラルを 8 個の 16bit hextet に展開する。`::` 圧縮と末尾の
 * IPv4 埋め込み(dotted)を受理する。解釈不能な形式は undefined を返し、
 * 呼び出し側は非公開扱い(fail-closed)に倒す。
 */
function parseIpv6Hextets(host: string): readonly number[] | undefined {
  if (host.includes('%')) return undefined; // zone id は許容しない
  const halves = host.split('::');
  if (halves.length > 2) return undefined;

  const parseHalf = (text: string): number[] | undefined => {
    if (text === '') return [];
    const groups = text.split(':');
    const out: number[] = [];
    for (let i = 0; i < groups.length; i += 1) {
      const group = groups[i]!;
      if (group === '') return undefined;
      if (group.includes('.')) {
        // 埋め込み IPv4 は末尾グループのみ許容(2 hextet 分)。
        if (i !== groups.length - 1) return undefined;
        const octets = group.split('.').map(Number);
        if (
          octets.length !== 4 ||
          octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)
        ) {
          return undefined;
        }
        out.push((octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!);
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(group)) return undefined;
        out.push(Number.parseInt(group, 16));
      }
    }
    return out;
  };

  const head = parseHalf(halves[0] ?? '');
  if (head === undefined) return undefined;
  if (halves.length === 1) {
    return head.length === 8 ? head : undefined;
  }
  const tail = parseHalf(halves[1] ?? '');
  if (tail === undefined) return undefined;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return undefined; // '::' は少なくとも 1 hextet を圧縮する
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

function embeddedIpv4(hextetHi: number, hextetLo: number): string {
  return `${hextetHi >> 8}.${hextetHi & 0xff}.${hextetLo >> 8}.${hextetLo & 0xff}`;
}

/**
 * 非公開・非到達または特殊用途の IPv6 を拒否する(IANA special registry +
 * API-010 §2「public 宛先のみ」)。文字列 prefix 比較は圧縮・16 進表記の
 * 揺れを取り逃すため、hextet 展開後に数値範囲で判定する。
 */
export function isPrivateIpv6(host: string): boolean {
  const hextets = parseIpv6Hextets(host.toLowerCase());
  if (hextets === undefined) return true;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets as [
    number, number, number, number, number, number, number, number,
  ];

  // ::/128 unspecified・::1/128 loopback(圧縮・非圧縮の全表記)。
  if (hextets.every((h) => h === 0)) return true;
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 1) {
    return true;
  }
  // ::ffff:a.b.c.d IPv4-mapped → 埋め込み IPv4 判定へ委譲。
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff) {
    return isPrivateIpv4(embeddedIpv4(h6, h7));
  }
  // ::ffff:0:a.b.c.d IPv4-translated(RFC 6052) → 埋め込み IPv4 判定へ委譲。
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0xffff && h5 === 0) {
    return isPrivateIpv4(embeddedIpv4(h6, h7));
  }
  // ::/96 IPv4-compatible(廃止済み) → 埋め込み IPv4 判定へ委譲。
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return isPrivateIpv4(embeddedIpv4(h6, h7));
  }
  // fe80::/10 link-local と fec0::/10 site-local(廃止済み)。
  if (h0 >= 0xfe80 && h0 <= 0xfeff) return true;
  // fc00::/7 unique-local。
  if ((h0 & 0xfe00) === 0xfc00) return true;
  // ff00::/8 multicast。
  if ((h0 & 0xff00) === 0xff00) return true;
  // 64:ff9b::/96 NAT64 と 64:ff9b:1::/48 local-use(h0=0x0064, h1=0xff9b)。
  if (h0 === 0x0064 && h1 === 0xff9b) return true;
  // 2001::/23 IETF 特殊用途(Teredo/benchmarking/ORCHID 等)と 2001:db8::/32 文書用。
  if (h0 === 0x2001 && (h1 <= 0x01ff || h1 === 0x0db8)) return true;
  // 2002::/16 6to4(廃止済み、IPv4 を埋め込む)。
  if (h0 === 0x2002) return true;
  // 3fff::/20 文書用。
  if (h0 === 0x3fff && h1 <= 0x0fff) return true;
  // 5f00::/16 SRv6 local-use。
  if (h0 === 0x5f00) return true;
  // 100::/64 discard-only。
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return true;
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export function normalizeHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.+$/, '');
}

export function assertPublicHttpsEndpoint(url: URL): void {
  if (url.protocol !== 'https:') throw new PartnerEndpointPolicyError('scheme must be https');
  if (url.port !== '' && url.port !== '443') throw new PartnerEndpointPolicyError('port must be 443');
  if (url.username !== '' || url.password !== '') {
    throw new PartnerEndpointPolicyError('credentials in url are not allowed');
  }
  const host = normalizeHostname(url);
  if (host.length === 0) throw new PartnerEndpointPolicyError('host is required');
  if (forbiddenHosts.has(host) || forbiddenHostSuffixes.some((suffix) => host.endsWith(suffix))) {
    throw new PartnerEndpointPolicyError('host is not public');
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) throw new PartnerEndpointPolicyError('private ipv4');
  if (ipVersion === 6 && isPrivateIpv6(host)) throw new PartnerEndpointPolicyError('private ipv6');
  if (ipVersion !== 0) throw new PartnerEndpointPolicyError('ip literal hosts are not allowed');
  if (!host.includes('.')) throw new PartnerEndpointPolicyError('host must be a public dns name');
}

/** DNS 解決結果の全アドレスが public であることを要求する(解決失敗も拒否)。 */
export async function assertResolvesToPublicAddress(
  url: URL,
  lookup: AddressLookup = defaultAddressLookup,
): Promise<void> {
  assertPublicHttpsEndpoint(url);
  let addresses: readonly { address: string; family: number }[];
  try {
    addresses = await lookup(normalizeHostname(url));
  } catch {
    throw new PartnerEndpointPolicyError('host does not resolve');
  }
  if (addresses.length === 0) throw new PartnerEndpointPolicyError('host does not resolve');
  for (const entry of addresses) {
    if (isPrivateAddress(entry.address)) {
      throw new PartnerEndpointPolicyError('host resolves to a private address');
    }
  }
}
