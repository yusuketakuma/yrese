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

export function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h.startsWith('::ffff:')) {
    // IPv4-mapped: 埋め込み IPv4 の判定へ委ねる(dotted / hex 両表記)。
    const tail = h.slice(7);
    if (isIP(tail) === 4) return isPrivateIpv4(tail);
    return true;
  }
  return (
    h === '::1' ||
    h === '::' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80') ||
    h.startsWith('fec0') ||
    h.startsWith('2001:db8') ||
    h.startsWith('64:ff9b')
  );
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
