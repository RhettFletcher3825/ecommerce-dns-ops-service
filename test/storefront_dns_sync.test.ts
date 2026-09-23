import { describe, expect, it } from 'vitest';
import { buildStorefrontDnsPlan } from '../src/storefront_dns_sync.js';

describe('buildStorefrontDnsPlan', () => {
  it('plans receipt, fulfillment, and tracking records for a send-now order', () => {
    const plan = buildStorefrontDnsPlan({
      domain: 'shop.example.com',
      checkout: {
        orderId: 'ord_1001',
        storeName: 'Northwind',
        receiptMode: 'send-now',
      },
      fulfillment: {
        shipmentId: 'shp_9001',
        provider: 'manual',
      },
      customerUpdate: {
        includeTrackingPortal: true,
      },
    });

    expect(plan).toHaveLength(3);
    expect(plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record_type: 'TXT',
          name: '@',
          content: 'v=spf1 include:mail.shop.example ~all',
        }),
        expect.objectContaining({
          record_type: 'CNAME',
          name: 'track',
          content: 'tracking.shop.example',
        }),
      ]),
    );
  });
});
