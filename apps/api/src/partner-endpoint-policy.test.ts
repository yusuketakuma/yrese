import { describe, expect, it } from 'vitest';

import {
  PartnerEndpointPolicyError,
  assertPublicHttpsEndpoint,
} from './partner-endpoint-policy.js';

describe('assertPublicHttpsEndpoint', () => {
  it('accepts a public https endpoint on the default port', () => {
    expect(() =>
      assertPublicHttpsEndpoint(new URL('https://hooks.partner.example/yrese')),
    ).not.toThrow();
    expect(() =>
      assertPublicHttpsEndpoint(
        new URL('https://hooks.partner.example:443/yrese'),
      ),
    ).not.toThrow();
  });

  it.each([
    ['http://hooks.partner.example/yrese', 'scheme'],
    ['https://hooks.partner.example:8443/yrese', 'port'],
    ['https://user:pw@hooks.partner.example/yrese', 'credentials'],
    ['https://localhost/yrese', 'not public'],
    ['https://api.internal/yrese', 'not public'],
    ['https://metadata.google.internal/computeMetadata/v1', 'not public'],
    ['https://127.0.0.1/yrese', 'private ipv4'],
    ['https://10.1.2.3/yrese', 'private ipv4'],
    ['https://169.254.169.254/latest/meta-data', 'private ipv4'],
    ['https://172.31.0.1/yrese', 'private ipv4'],
    ['https://192.168.1.1/yrese', 'private ipv4'],
    ['https://[::1]/yrese', 'private ipv6'],
    ['https://[fd00::1]/yrese', 'private ipv6'],
    ['https://203.0.113.9/yrese', 'ip literal'],
    ['https://intranet/yrese', 'public dns name'],
  ])('rejects %s (%s)', (url, reason) => {
    expect(() => assertPublicHttpsEndpoint(new URL(url))).toThrow(
      PartnerEndpointPolicyError,
    );
    try {
      assertPublicHttpsEndpoint(new URL(url));
    } catch (error) {
      expect((error as PartnerEndpointPolicyError).reason).toContain(reason);
    }
  });
});
