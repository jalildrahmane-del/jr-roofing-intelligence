# Owner staging cost proposal — 18 October 2026

No expenditure has been authorised or incurred. Currency: USD, before applicable tax/FX/card charges. This is a usage estimate, not a fixed-price quotation. No domain purchase is included.

## Exact proposed plan

Railway **Hobby**: US$5 monthly minimum including US$5 resource usage; pay the greater of US$5 and metered usage, not US$5 plus all usage. One ordinary application service, one replica, one Europe region, 0.5 GB RAM / 0.5 vCPU maximum settings, one 5 GB volume with initially about 1 GB used. No database service, AI agent, email provider, object-store service or additional app replicas.

Cloudflare **Zero Trust Free / Access**, for the small named-reviewer group (under 50 users): US$0. Existing Cloudflare DNS/TLS: no proposed paid add-on. Separate encrypted backups on existing owner-controlled storage: no new service subscription. Domain: an existing approved domain is required; registration/renewal is excluded and not authorised.

## Itemised 30-day resource model

Official Railway rates checked today: RAM US$0.00000386/GB-second; CPU US$0.00000772/vCPU-second; volume US$0.00000006/GB-second; application egress US$0.05/GB. Native snapshots are charged on incremental data at volume rates.

| Item | Light owner use assumption | Monthly resource estimate |
| --- | --- | ---: |
| RAM | 0.25 GB average, 30 days | $2.50 |
| CPU | 0.03 vCPU average, 30 days | $0.60 |
| SQLite/photos volume | 1 GB actually stored | $0.16 |
| Optional Railway snapshots | 0.5 GB incremental stored | $0.08 |
| Network egress, including downloads/backups | 2 GB | $0.10 |
| Total metered usage | Rounded | **$3.44** |
| Hobby invoice minimum | Usage below included $5 | **$5.00** |
| Cloudflare Access Free | Small named group | $0.00 |
| Off-volume encrypted backups | Existing owner storage | $0.00 incremental |

Higher-use illustration: average 0.5 GB RAM and 0.1 vCPU, 1 GB data, 0.5 GB incremental snapshots and 5 GB egress: about **$7.49/month**. This is an inference from resource assumptions, not observed application usage. CPU/PDF spikes, storage growth or longer downloads can raise the bill. At resource ceilings continuously, costs could exceed $10; limits are not a flat-price plan.

**Proposed approval envelope: expect $5–$10/month before tax; set $7.50 usage alert and $10 compute hard threshold.** Reaching the threshold takes the review app offline. Verify the provider's billing semantics, minimum commitment, storage treatment and metering delay in the account before activation; a threshold is not a guarantee of an exact invoice cap. Do not raise it without approval. Railway Agent usage is separate: do not activate that product.

## Primary pricing and platform sources

- Railway pricing: https://railway.com/pricing
- Billing treatment: https://docs.railway.com/pricing/understanding-your-bill
- Usage thresholds: https://docs.railway.com/pricing/cost-control
- Volume/snapshot billing and limitations: https://docs.railway.com/volumes/backups
- Cloudflare Access Free plan: https://www.cloudflare.com/sase/products/access/
- Cloudflare hostname prerequisite: https://developers.cloudflare.com/learning-paths/clientless-access/access-application/create-access-app/

Recheck prices and account availability immediately before any approved provisioning. No exchange-rate conversion or assumed existing-domain ownership is used.
