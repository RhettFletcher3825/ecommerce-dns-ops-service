import { z } from 'zod';
import { infrai } from './infrai_client.js';

const requestSchema = z.object({
  domain: z.string().min(1),
  checkout: z.object({
    orderId: z.string().min(1),
    storeName: z.string().min(1),
    receiptMode: z.enum(['send-now', 'manual']),
  }),
  fulfillment: z.object({
    shipmentId: z.string().min(1),
    provider: z.enum(['manual', '3pl']),
  }),
  customerUpdate: z.object({
    includeTrackingPortal: z.boolean(),
  }),
});

export type StorefrontDnsRequest = z.infer<typeof requestSchema>;

export type PlannedRecord = {
  record_type: 'TXT' | 'CNAME' | 'MX' | 'A';
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  metadata: Record<string, unknown>;
};

export type DnsSyncResult = {
  domain: string;
  zoneId: string;
  appliedRecords: PlannedRecord[];
  summary: string;
};

function readZoneId(data: unknown): string {
  const zone = z
    .object({
      zone_id: z.string().min(1),
    })
    .passthrough()
    .parse(data);
  return zone.zone_id;
}

export function buildStorefrontDnsPlan(input: StorefrontDnsRequest): PlannedRecord[] {
  const req = requestSchema.parse(input);
  const records: PlannedRecord[] = [];

  if (req.checkout.receiptMode === 'send-now') {
    records.push({
      record_type: 'TXT',
      name: '@',
      content: 'v=spf1 include:mail.shop.example ~all',
      ttl: 300,
      metadata: {
        order_id: req.checkout.orderId,
        purpose: 'receipts',
        store_name: req.checkout.storeName,
      },
    });
  }

  records.push({
    record_type: 'TXT',
    name: '_fulfillment',
    content: `shipment=${req.fulfillment.shipmentId};provider=${req.fulfillment.provider}`,
    ttl: 300,
    metadata: {
      order_id: req.checkout.orderId,
      purpose: 'fulfillment',
    },
  });

  if (req.customerUpdate.includeTrackingPortal) {
    records.push({
      record_type: 'CNAME',
      name: 'track',
      content: 'tracking.shop.example',
      ttl: 300,
      proxied: false,
      metadata: {
        order_id: req.checkout.orderId,
        purpose: 'customer_updates',
      },
    });
  }

  return records;
}

export async function syncStorefrontDns(input: StorefrontDnsRequest): Promise<DnsSyncResult> {
  const req = requestSchema.parse(input);
  const zoneResponse = await infrai.dns.domain.get({ domain: req.domain });
  const zoneId = readZoneId(zoneResponse.data);

  await infrai.dns.record.list({ zone_id: zoneId });

  const plan = buildStorefrontDnsPlan(req);

  for (const record of plan) {
    await infrai.dns.record.upsert({
      zone_id: zoneId,
      record_type: record.record_type,
      name: record.name,
      content: record.content,
      ttl: record.ttl,
      proxied: record.proxied,
      metadata: record.metadata,
    });
  }

  return {
    domain: req.domain,
    zoneId,
    appliedRecords: plan,
    summary: `Applied ${plan.length} DNS records for order ${req.checkout.orderId} on ${req.domain}`,
  };
}
