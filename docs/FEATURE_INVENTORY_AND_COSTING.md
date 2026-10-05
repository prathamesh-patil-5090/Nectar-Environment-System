# Nectar Enviro Ops Console — Feature Inventory & Service Costing

**Product:** Workforce & site operations console (employees, shifts, leave, relievers, OT, training, safety)  
**Architecture:** **Monolith app** on one EC2 — Next.js UI + NestJS API + JWT; **Amazon DocumentDB** for data; **S3** for pics/videos  
**Auth:** App **JWT** via existing **`/login` page** (no Cognito)  
**Region:** **AWS Asia Pacific (Mumbai) `ap-south-1`**  
**Doc date:** 4 Oct 2026  
**Companion docs:** [PAGES_AND_FEATURES.md](./PAGES_AND_FEATURES.md), [SAFETY_PLAN.md](./SAFETY_PLAN.md), [SAFETY_REPORTS_AND_PROTOCOLS_TODO.md](./SAFETY_REPORTS_AND_PROTOCOLS_TODO.md)

---

## 0. How to read this document

| Column | Meaning |
|--------|---------|
| **Concept / feature** | Major capability on that page |
| **Current work** | What works in the demo / codebase today |
| **Future work** | Product / technical gap still open |
| **Est. cost** | **AWS / cloud services** used by that feature (USD / month). **Not** engineering build labour. |

### Shared platform (what every page uses)

| Shared service | Spec (Mumbai list price) | Est. cost |
|---|---|---|
| EC2 compute | `t3.medium` Linux On-Demand — `$0.0448`/hr × 730 hr | **$32.70 / mo** |
| EBS disk | **20 GB gp3** (OS + app only) @ `$0.0912`/GB·mo | **$1.82 / mo** |
| Public IPv4 | 1 in-use @ `$0.005`/hr × 730 | **$3.65 / mo** |
| **Amazon DocumentDB** | 1× `db.t4g.medium` (standard) — `$0.10961`/hr × 730 | **$80.02 / mo** |
| DocumentDB storage | 20 GB consumed @ `$0.11`/GB·mo | **$2.20 / mo** |
| DocumentDB I/O | ~5M I/Os @ `$0.22` / 1M requests (light ops console) | **~$1.10 / mo** |
| **Amazon S3** Standard | 50 GB pics/videos @ `$0.025`/GB·mo (first 50 TB tier) | **$1.25 / mo** |
| S3 requests | ~10k PUT + ~100k GET @ `$0.005`/1k PUT, `$0.0004`/1k GET | **~$0.09 / mo** |
| Data transfer out | First **100 GB/mo free** (global); then `$0.1093`/GB Mumbai → Internet | **$0 / mo** typical |
| **Shared platform total** | | **~$123 / mo** |

A feature’s **Est. cost** is therefore:

- **Included in platform** → uses shared EC2 + DocumentDB + S3 (no extra meter)
- **+$X / mo** → needs an *extra* service (SES, SMS, larger DocDB, more S3 GB, etc.)

**Not purchased:** CloudFront · Cognito · ALB · CloudWatch · AWS Backup · Atlas · Amplify · QuickSight.

```text
Internet → EC2 Elastic IP :443 (nginx + Let’s Encrypt)
              ├── Next.js (UI)
              ├── NestJS (API + JWT)
              ├── Amazon DocumentDB  (Mongo-compatible data)
              └── Amazon S3          (pics / videos / media)
```

**Why DocumentDB + S3 (not Mongo/media on the EC2 disk):**

| Store | Role |
|---|---|
| **DocumentDB** | Managed Mongo-compatible DB — backups, patching, survives EC2 replace |
| **S3** | Object storage for photos/videos — cheap at scale, durable, separate from the app box |
| **EBS (small)** | Only OS + Nest/Next binaries — no DB files, no media library |

Sources (list price, `ap-south-1`, Sep 2026 AWS Price List): `AmazonEC2` · `AmazonVPC` · `AmazonDocDB` · `AmazonS3` · `AWSDataTransfer` · [EC2 On-Demand](https://aws.amazon.com/ec2/pricing/on-demand/) · [DocumentDB pricing](https://aws.amazon.com/documentdb/pricing/) · [S3 pricing](https://aws.amazon.com/s3/pricing/) · [EBS pricing](https://aws.amazon.com/ebs/pricing/) · [AWS Pricing Calculator](https://calculator.aws/).

---

## 1. Access & shell

### `/login` — Sign-in (**kept**)

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| Branded login | Demo email/password | JWT issue from Nest on EC2 | **Included in platform** |
| Session / JWT | `localStorage` demo session | Access token from API | **Included in platform** (no Cognito) |
| Demo users | Seeded roles | Users in **DocumentDB** | **Included in DocumentDB** |

**Page service cost:** **$0** beyond shared platform.

### AppShell

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| Collapsible sider | Persisted in browser | — | **$0** (browser only) |
| RBAC nav | Role-filtered menus | Roles from JWT claims | **Included in platform** |
| Notifications bell | Inbox link | Poll Nest API | **Included in platform** |

---

## 2. Core pages

### `/dashboard`

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| KPI strip | Mock aggregations | Query **DocumentDB** | **Included in DocumentDB** |
| Role dual view | Client-side | Same | **Included in platform** |

### `/employees`, `/employees/[id]`

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| Employee master | Demo / API path | CRUD in **DocumentDB** | **Included in DocumentDB** |
| Profile photos | — | Objects in **S3** | **Included in S3** (`$0.025`/GB·mo) |

### `/sites`

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| Plant directory | Demo plants | **DocumentDB** | **Included in DocumentDB** |

### `/notifications`

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| In-app inbox | Demo store / API | **DocumentDB** + poll | **Included in DocumentDB** |
| Email digest (optional later) | — | Amazon SES | **+$0.10 / 1k emails** ([SES](https://aws.amazon.com/ses/pricing/)) |
| SMS (optional later) | — | SNS / third-party | **+$0.006–0.02 / SMS** (region-dependent) |

### `/salary`, `/meetings`, `/certifications`

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| Salary / certs | Light / placeholder | **DocumentDB** | **Included in DocumentDB** |
| Meetings (Jitsi) | Placeholder | Self-host on EC2 or free Jitsi SaaS | **Included in EC2** or **$0** (public Jitsi) |

---

## 3. Training / Academy

| Concept | Current work | Future work | Est. cost (services) |
|---|---|---|---|
| Catalog, courses, learn player | Rich client demo | Content + progress in **DocumentDB** | **Included in DocumentDB** |
| Course videos | Mock / light assets | Objects in **S3** | **S3 `$0.025`/GB·mo** (+ GET requests) |
| Events / RSVP | Demo | **DocumentDB** | **Included in DocumentDB** |
| Certificates PDF | Client-side | Generate on Nest; optional PDF → S3 | **Included in EC2**; store **Included in S3** |

**Module service cost:** **$0** incremental beyond shared S3 GB used by videos.

---

## 4. Shifts module

| Route | Concepts | Current work | Future work | Est. cost (services) |
|---|---|---|---|---|
| `/shifts` | KPIs, drafts | Demo | DocumentDB | **Included in DocumentDB** |
| `/shifts/master` | Shift codes, rest rules | Demo | DocumentDB | **Included in DocumentDB** |
| `/shifts/schedule` | Live roster view | Demo | DocumentDB | **Included in DocumentDB** |
| `/shifts/rotation` | Monthly builder + publish | Working demo | DocumentDB | **Included in DocumentDB** |
| `/shifts/change-requests` | Day swaps | Demo + guards | DocumentDB | **Included in DocumentDB** |
| `/shifts/reliever-allocation` | Gap forecast | Demo | DocumentDB | **Included in DocumentDB** |
| `/shifts/deviations` | Planned vs actual | Seeded | DocumentDB | **Included in DocumentDB** |
| `/shifts/manpower` | Manpower | Present | DocumentDB | **Included in DocumentDB** |

**Module service cost:** **$0** incremental.

---

## 5. Reliever pool

| Route | Concepts | Current work | Future work | Est. cost (services) |
|---|---|---|---|---|
| `/reliever-pool` | Cluster pool, assign | Demo + sync path | DocumentDB | **Included in DocumentDB** |
| `/reliever-pool/competition` | Competition UX | Demo | DocumentDB | **Included in DocumentDB** |

**Module service cost:** **$0** incremental.

---

## 6. Leave module

| Route | Concepts | Current work | Future work | Est. cost (services) |
|---|---|---|---|---|
| `/leave` | Overview | Demo | DocumentDB | **Included in DocumentDB** |
| `/leave/requests` | Create / list / policy | Working demo | DocumentDB | **Included in DocumentDB** |
| `/leave/requests/[id]` | Approve, cover, OT person pick | Working demo | DocumentDB | **Included in DocumentDB** |
| `/leave/pending` | Justifications | Demo | DocumentDB | **Included in DocumentDB** |
| `/leave/management` | Exceptions | Demo | DocumentDB | **Included in DocumentDB** |
| Leave email notify (optional) | In-app only today | SES | **+$0.10 / 1k emails** |

**Module service cost:** **$0** incremental (SES only if you enable email).

---

## 7. OverTime (OT) module

| Route | Concepts | Current work | Future work | Est. cost (services) |
|---|---|---|---|---|
| `/overtime/*` pages | Overview, employees, sites, analysis, reports, assign, decisions | Demo | DocumentDB | **Included in DocumentDB** |
| Report download | Client / Nest file | Same; optional export → S3 | **Included in platform** |
| Assign notify (optional SMS) | In-app | SNS / SMS provider | **+$0.006–0.02 / SMS** |
| Assign notify (optional email) | — | SES | **+$0.10 / 1k emails** |
| BI export (optional) | — | QuickSight — **not in baseline** | Avoided ($0) |

**Module service cost:** **$0** incremental in baseline.

---

## 8. Safety module

| Route | Concepts | Current work | Future work | Est. cost (services) |
|---|---|---|---|---|
| `/safety` | KPIs | Working | DocumentDB | **Included in DocumentDB** |
| `/safety/report` | Post-incident report, multi people, Other hazard, media | Working | Metadata → DocumentDB; files → **S3** | **Included in DocumentDB + S3** |
| `/safety/incidents` + `[id]` | History, gallery, PDF, Jitsi | Working | Gallery from **S3** URLs | **Included in S3** |
| `/safety/breakdowns` | Downtime + OT link | Working | DocumentDB | **Included in DocumentDB** |
| `/safety/protocols` | Add / edit / soft-delete | Working | DocumentDB | **Included in DocumentDB** |
| `/safety/training` | Safety courses filter | Working | DocumentDB | **Included in DocumentDB** |
| Photo / video storage | Upload path exists | **S3 Standard** Mumbai | **`$0.025`/GB·mo** + PUT/GET request fees |

**Module service cost:** media billed under shared **S3** (grow GB as library grows: **+$0.25 per +10 GB**).

---

## 9. Platform services (what you actually pay AWS)

### 9.1 Unit rates used (Mumbai `ap-south-1` list)

| Meter | Unit rate | Source SKU / note |
|---|---|---|
| EC2 `t3.medium` Linux | **`$0.0448` / hr** | `APS3-BoxUsage:t3.medium` |
| EBS gp3 storage | **`$0.0912` / GB·mo** | `APS3-EBS:VolumeUsage.gp3` (3,000 IOPS + 125 MB/s included) |
| Public IPv4 in-use | **`$0.005` / hr** | `APS3-PublicIPv4:InUseAddress` |
| DocumentDB `db.t4g.medium` | **`$0.10961` / hr** | `APS3-InstanceUsage:db.t4g.medium` |
| DocumentDB `db.t3.medium` (alt) | **`$0.113` / hr** | `APS3-InstanceUsage:db.t3.medium` |
| DocumentDB storage | **`$0.11` / GB·mo** | `APS3-StorageUsage` |
| DocumentDB I/O | **`$0.22` / 1M I/Os** | `APS3-StorageIOUsage` |
| DocumentDB backup (over free) | **`$0.023` / GB·mo** | Free allocation = size of cluster storage |
| S3 Standard storage | **`$0.025` / GB·mo** (first 50 TB) | `APS3-TimedStorage-ByteHrs` |
| S3 PUT/COPY/POST/LIST | **`$0.005` / 1,000** | `APS3-Requests-Tier1` |
| S3 GET + other | **`$0.0004` / 1,000** | `APS3-Requests-Tier2` |
| Data transfer out → Internet | **100 GB free / mo**; then **`$0.1093` / GB** | `APS3-DataTransfer-Out-Bytes` |

### 9.2 Baseline monthly bill

| Service | Used by | Calculation | Est. cost |
|---|---|---|---|
| **EC2 `t3.medium`** | UI + API + JWT | `$0.0448` × 730 | **$32.70** |
| **EBS 20 GB gp3** | OS + app only | 20 × `$0.0912` | **$1.82** |
| **Public IPv4** | Browser access | `$0.005` × 730 | **$3.65** |
| **DocumentDB** `db.t4g.medium` × 1 | All app data | `$0.10961` × 730 | **$80.02** |
| DocumentDB storage | 20 GB data | 20 × `$0.11` | **$2.20** |
| DocumentDB I/O | ~5M / mo | 5 × `$0.22` | **$1.10** |
| **S3** Standard | Pics / videos | 50 × `$0.025` | **$1.25** |
| S3 requests | Uploads + views | ~10k PUT + ~100k GET | **$0.09** |
| Data transfer out | EC2 + S3 → browsers | ≤100 GB Free Tier | **$0** |
| JWT / nginx / Let’s Encrypt | App on EC2 | — | **$0** |
| **Total AWS (baseline)** | | | **~$123 / mo** |
| **Year-1 AWS** | | | **~$1,475** |

### 9.3 Size / HA variants

| Variant | Change | Est. monthly delta |
|---|---|---|
| Smaller media library | S3 **20 GB** | **−$0.75** → ~$122 |
| Larger media library | S3 **100 GB** | **+$1.25** → ~$124 |
| DocDB alt instance | `db.t3.medium` @ `$0.113`/hr | **+$2.47** → ~$125 |
| DocDB production HA | **3×** `db.t4g.medium` (Multi-AZ cluster) | instance **$240** + storage/IO → **~$285+ / mo** all-in |
| Larger EC2 | `t3.large` @ ~`$0.0896`/hr | compute **~$65.41** → platform **~$156** |
| Heavy DocDB I/O | 50M I/Os | I/O **$11** instead of $1.10 |

### 9.4 Optional add-ons (only if you turn them on)

| Add-on | When | Est. cost |
|---|---|---|
| Amazon SES | Email leave/OT/safety digests | **~$0.10 / 1k emails** |
| Amazon SNS SMS | OT assign SMS | **per SMS** |
| Extra S3 GB | More safety / training media | **+$0.025 / GB·mo** |
| DocDB backup over free allocation | Long retention | **+$0.023 / GB·mo** |

### Never in this baseline bill

CDN · Cognito · ALB · CloudWatch · AWS Backup · Atlas · Amplify · QuickSight · self-hosted Mongo on EBS.

---

## 10. Service cost by module (monthly rollup)

App modules share one platform. There is **no separate meter per page**.

| Module | Est. AWS / services cost |
|---|---|
| Login + shell | Included in EC2 |
| Dashboard / employees / sites | Included in DocumentDB (+ S3 for photos) |
| Notifications (in-app) | Included in DocumentDB |
| Training | Included in DocumentDB (+ S3 for videos) |
| Shifts | Included in DocumentDB |
| Reliever | Included in DocumentDB |
| Leave | Included in DocumentDB |
| OT | Included in DocumentDB |
| Safety | Included in DocumentDB (+ **S3** for images/videos) |
| **Shared platform bill** | **~$123 / mo** |
| **Optional SES / SMS** | Pay only if enabled |

---

## 11. Current total costing (services only)

| Item | Low | Mid | High |
|---|---|---|---|
| **AWS monthly** | $120 | $123 | $160 |
| **AWS yearly** | $1,440 | $1,475 | $1,920 |
| DocumentDB HA (3× `db.t4g.medium`) | — | — | ~$285+ / mo |
| Data transfer overage (example +50 GB) | — | +$5.47 | — |
| Optional SES (e.g. 20k emails/mo) | — | +$2 | — |
| Optional SMS (e.g. 500 SMS/mo @ $0.01) | — | +$5 | — |

*Low = 20 GB S3, light DocDB I/O, single DocDB instance. Mid = 50 GB S3 baseline above. High ≈ larger EC2 or heavier I/O / media — still single DocDB unless HA is chosen.*

### One-line stakeholder view

> **Est. cost = cloud services, not build labour.** About **USD $123 / month** in Mumbai for EC2 (app) + **DocumentDB** (data) + **S3** (pics/videos) + small EBS + public IPv4. Data transfer is usually **$0** under the 100 GB Free Tier. No CDN, Cognito, or ALB in the bill.

---

## 12. Page index

| Route | Module |
|---|---|
| `/login` | Access (JWT) |
| `/dashboard` | Core |
| `/employees`, `/employees/[id]` | Core |
| `/sites` | Core |
| `/notifications` | Core |
| `/salary`, `/meetings`, `/certifications` | Core (light) |
| `/training/*` | Training |
| `/shifts/*` | Shifts |
| `/reliever-pool/*` | Reliever |
| `/leave/*` | Leave |
| `/overtime/*` | OT |
| `/safety/*` | Safety |

---

## 13. Sources

| Topic | URL |
|---|---|
| EC2 On-Demand | https://aws.amazon.com/ec2/pricing/on-demand/ |
| DocumentDB pricing | https://aws.amazon.com/documentdb/pricing/ |
| S3 pricing | https://aws.amazon.com/s3/pricing/ |
| EBS pricing | https://aws.amazon.com/ebs/pricing/ |
| SES | https://aws.amazon.com/ses/pricing/ |
| AWS Pricing Calculator | https://calculator.aws/ |
| Price List API (used for Mumbai rates) | `AmazonEC2` · `AmazonDocDB` · `AmazonS3` · `AmazonVPC` · `AWSDataTransfer` (pub. Sep 2026) |

---

## 14. Disclaimer

**Est. cost** means **AWS service usage**, not developer time. Figures use **On-Demand list prices** in `ap-south-1` (no Savings Plans / Reserved). DocumentDB I/O and S3 request volume vary with traffic — confirm in the [AWS Pricing Calculator](https://calculator.aws/) before purchase. Production HA DocumentDB (multi-instance) is much more expensive than the single-instance baseline.
