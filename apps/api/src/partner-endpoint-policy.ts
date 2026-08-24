import { isIP } from 'node:net';

/**
 * DeliveryEndpoint の宛先統制(API-010 §2、security review finding H3)。
 * 登録時と配送時の両方で呼ぶ。合格 = https、既定ポート、IP リテラルでない公開ホスト。
 *
 * ponytail: DNS 解決結果(rebinding)の検査は行わない。egress を担う network 層
 * (allow-list / proxy)で二重化する前提。配送は fetch の redirect: 'error' で非追従。
 */
export class PartnerEndpointPolicyError extends RangeError {
  constructor(readonly reason: string) {
    super(`partner endpoint rejected: ${reason}`);
    this.name = 'PartnerEndpointPolicyError';
  }
}

const forbiddenHostSuffixes = ['.local', '.localhost', '.internal', '.arpa'];
const forbiddenHosts = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  const [a, b] = parts;
  if (a === undefined || b === undefined) return true;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === '::1' ||
    h === '::' ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    h.startsWith('fe80') ||
    h.startsWith('::ffff:')
  );
}

export function assertPublicHttpsEndpoint(url: URL): void {
  if (url.protocol !== 'https:') throw new PartnerEndpointPolicyError('scheme must be https');
  if (url.port !== '' && url.port !== '443') throw new PartnerEndpointPolicyError('port must be 443');
  if (url.username !== '' || url.password !== '') {
    throw new PartnerEndpointPolicyError('credentials in url are not allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
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
