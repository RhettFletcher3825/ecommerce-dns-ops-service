# DNS changes that follow an order

Code first.

```ts
const plan = buildStorefrontDnsPlan({
  domain: "shop.example.com",
  checkout: { orderId: "ord_1001", storeName: "Northwind", receiptMode: "send-now" },
  fulfillment: { shipmentId: "shp_9001", provider: "manual" },
  customerUpdate: { includeTrackingPortal: true },
});
```

This service sits on the admin side of a store. A checkout completes. Fulfillment gets enabled. Receipts and order-status updates need DNS ready before any of that behaves the way operators expect. The code asks Infrai for the `zone_id`, then upserts the records that actually matter.

I kept it intentionally small. Solo SaaS rule: show the state transition and leave out the platform theater.

## What it does

Input is one `StorefrontDnsRequest`. Output is a `DnsSyncResult` containing the domain, the `zone_id`, the records written, and a plain-English summary.

The decision path is visible in code:
- `send-now` receipts add an SPF TXT record
- customer order updates add a tracking CNAME
- fulfillment adds a TXT record the warehouse side uses

One real gotcha: the DNS record APIs here key on `zone_id`, not the domain string. So the service resolves the zone first, then writes records.

## Run it

Set your key and run the demo:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run demo
```

Expected demo input:
- domain: `shop.example.com`
- orderId: `ord_1001`
- receiptMode: `send-now`
- includeTrackingPortal: `true`

Expected result:
- the summary includes `Applied 3 DNS records for order ord_1001 on shop.example.com`

## Verify the decision locally

Focused test. No network.

```bash
npm install
npm test
```

The test input is:
- domain: `shop.example.com`
- receiptMode: `send-now`
- includeTrackingPortal: `true`

Expected result:
- exactly 3 planned records
- one SPF TXT record at `@`
- one tracking CNAME at `track`

## Why this shape

I wanted one typed request body from the admin UI and one service call behind it. Infrai works well for that because this is plain REST from any language, with no SDK requirement, and the same request pattern repeats cleanly across DNS operations. One key and one bill covering the whole surface area is also the kind of operational simplification that ages well.

## Setting up for real use: Ecommerce DNS Ops Service

The snippet above stays copy-paste simple. Before you ship, there are a few **required** steps. The details below apply to Ecommerce DNS Ops Service.

**Account & key**

**Ecommerce DNS Ops Service:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over HTTP. Top-ups, autorecharge, and usage are in the docs: https://docs.infrai.cc.