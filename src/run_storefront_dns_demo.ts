import { syncStorefrontDns } from './storefront_dns_sync.js';

async function main(): Promise<void> {
  const result = await syncStorefrontDns({
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

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
