# VEENCART LOGISTICS — UI DESIGN BRIEF

**Document:** `UI-DESIGN.md`
**Product:** Veencart Logistics
**Version:** 1.0
**Status:** Proposed design baseline; pending client brand and workflow confirmation

---

## 1. Product vision

Build a premium, trustworthy, mobile-first Nigerian logistics and commerce
platform that lets customers book deliveries, obtain pricing, pay online, track
shipments and shop products. Staff need efficient operational tools, while
drivers need a fast, simple interface for managing assigned deliveries.

The experience must communicate clarity, reliability, care and accountability.
It must feel like a thoughtfully designed logistics company, not a generic SaaS
template.

## 2. Confirmed scope

- Public marketing website.
- Guest delivery booking and optional customer accounts.
- Nigeria-wide service, subject to confirmed route availability.
- Daily, scheduled and bulk delivery request types.
- Hybrid fixed and manual pricing.
- Online payments through Paystack, subject to enabled methods and merchant
  configuration.
- Shipment tracking.
- Marketplace and product orders in the initial build.
- Staff and dispatcher workspaces.
- Driver workspace with assigned deliveries.
- Email notifications initially.
- Cloudflare R2 for object storage.
- No existing production booking system to integrate.

## 3. Design principles

1. Trust before decoration.
2. Obvious primary actions and predictable navigation.
3. Mobile-first layouts that work from 320 px viewport width.
4. Distinct customer, staff and driver experiences within one design system.
5. Clear distinction between requested, quoted, confirmed, paid, assigned,
   in-transit and delivered.
6. Accessible controls, readable typography and meaningful error messages.
7. Realistic content and honest system states.
8. No functionality represented by a decorative element that does nothing.

## 4. Visual identity

### Color direction

| Token          | Value     | Role                                  |
| -------------- | --------- | ------------------------------------- |
| Deep teal      | `#0B4F4A` | Brand surfaces, headings, nav emphasis |
| Primary teal   | `#087E67` | Primary action, links, active states   |
| Brand orange   | `#F4773B` | Secondary emphasis, promotions         |
| Warm white     | `#F7F8F5` | Page background                        |
| White          | `#FFFFFF` | Card and content surface               |
| Ink            | `#202927` | Primary text                           |
| Muted text     | `#66736F` | Secondary text                         |
| Border         | `#E5E9E5` | Hairline dividers                      |
| Pale mint      | `#DCEFE8` | Subtle brand panels                    |
| Pale orange    | `#FFF0E5` | Soft orange surfaces                   |

> **Accessibility correction applied at implementation.** These values are the
> proposed brand palette, but two of them do not meet WCAG 2.1 AA as originally
> paired. Measured with `npm run check:contrast`:
>
> | Pairing                             | Ratio  | Required | Result |
> | ----------------------------------- | ------ | -------- | ------ |
> | `#FFFFFF` on `#F4773B` (orange btn) | 2.78:1 | 4.5:1    | FAIL   |
> | `#F4773B` on `#FFFFFF` (orange text)| 2.78:1 | 4.5:1    | FAIL   |
> | `#66736F` on `#F1F4F1`              | 4.46:1 | 4.5:1    | FAIL   |
> | `#B8C3BD` on `#FFFFFF` (control edge)| 1.81:1 | 3.0:1    | FAIL   |
>
> Resolutions actually implemented (all verified, with headroom):
>
> - Brand orange is used as a **fill with ink text** — `#202927` on `#F4773B` is
>   **5.36:1** and passes comfortably. White text on orange is never used.
> - For orange fills that must carry white text, use `--color-accent-700`
>   (`#B2551F`, **4.99:1**).
> - Secondary text is `#5F6C68` (**4.95:1** on muted surface, **5.48:1** on white).
> - Control and strong borders are `#808B87` (**3.52:1**, satisfying the 3:1
>   non-text requirement of WCAG 1.4.11).
>
> The supplied Veencart logo remains the source of truth for the final brand
> colours. Reconcile against it before release; do not silently revert these
> corrections.

### Typography

Use Inter with system sans-serif fallbacks. Headings confident and concise; body
conversational, professional and specific. Use tabular numerals for financial
figures, tracking references and timestamps.

### Art direction

Documentary-style photography of parcels, couriers, delivery interactions,
commerce and real-world Nigerian environments. Natural light, believable scenes,
restrained treatment.

Avoid neon, purple gradients, excessive glassmorphism, oversized decorative
blobs, gratuitous animation, glossy 3D illustration and generic AI dashboard
aesthetics.

## 5. Information architecture

### Public website

Home · Services · How It Works · Track Shipment · Store · About · Contact ·
Book a Delivery · Sign In / Create Account.

Provide privacy and terms pages before production launch. Do not use
placeholder legal links.

### Customer workspace

Overview · New Booking · My Bookings · Shipment Details · Track Shipment ·
Quotes and Payment · Store Orders · Saved Addresses · Profile and Security ·
Notifications.

Guests must book and track through secure access mechanisms without registering.

### Staff workspace

Operations Overview · Booking Queue · Quote Management · Shipments · Dispatch
Board · Driver Management · Customers · Marketplace Products · Inventory ·
Product Orders · Payments and Refunds · Notifications · Audit Logs · Settings.

Show only sections the current user is permitted to see.

### Driver workspace

Assigned Deliveries · Delivery Details · Pickup Instructions · Recipient
Details · Update Delivery Status · Delivery Evidence · Delivery History ·
Profile.

Optimise for one-handed Android use, outdoor visibility and low bandwidth.

## 6. Public homepage

**Header** — logo, primary navigation, a restrained Store link, a Track Shipment
action and a clear Book a Delivery button. On mobile, a compact header with an
accessible menu and a prominent booking action. Do not overload the header.

**Hero** — headline: *Your deliveries, handled with care.* Supporting copy: "Book
local and interstate deliveries, get a confirmed price and follow your shipment
from pickup to delivery." Primary CTA **Book a Delivery**, secondary CTA **Track
a Shipment**. Use a genuine logistics photograph; avoid unsupported guarantees.

**Service cards** — Daily, Scheduled, Bulk and Interstate (subject to route
availability). Plain language, linking to the booking flow. No invented delivery
times or prices.

**How it works** — 1. Enter pickup and delivery details. 2. Receive an available
tariff or request a quote. 3. Confirm the booking and complete applicable
payment steps. 4. Follow the shipment through its tracking timeline.

**Tracking section** — prominent shipment-reference field, clear validation.
Public tracking must not expose private addresses, phone numbers or internal
staff notes.

**Marketplace preview** — curated products with real photographs, clear prices,
availability from the database.

**Trust and contact** — verifiable service information, clear support channels,
a concise handling explanation, real business details supplied by the client. No
fabricated testimonials, statistics, ratings or certifications.

## 7. Booking experience

Visible progress across: Service type → Pickup and destination → Parcel details
→ Sender, recipient and payer → Price confirmation or manual quote → Review and
submission → Payment where required → Confirmation with tracking reference.

- Preserve valid data between steps.
- Inline validation plus a clear summary of errors.
- Guest booking allowed.
- Explain when a route requires manual confirmation.
- Never invent a price when a tariff is unavailable.
- Distinguish booking submission from booking confirmation.
- Identify who is expected to pay and the amount due.
- Never present a booking as paid until the server verifies payment.
- Confirm with reference, current status and next steps.

## 8. Tracking experience

Show tracking reference, current verified status, milestones, event timestamps,
estimated delivery only where reliable data supports it, and a support action
for delayed, failed or exceptional deliveries.

Vertical timeline on mobile; wider timeline with summary panel on desktop.

Do not present manually recorded milestones as live GPS tracking.

## 9. Marketplace and checkout

**Store** — category navigation, functional search and filters, product cards
with image, name, price and availability, detail pages with quantity controls,
plus empty, unavailable and error states.

**Checkout** — contact and delivery details, order summary, delivery charges
shown separately from product prices, payment methods actually enabled for the
merchant, Paystack checkout, confirmation and order reference.

Never trust client-submitted prices or stock availability; revalidate server-side.

## 10. Staff experience

The staff dashboard is an operational tool, not a marketing page. Prioritise:
bookings needing review, quotes awaiting approval or customer response,
unassigned shipments, drivers and active assignments, delivery exceptions,
pending payment verification, orders requiring fulfilment, inventory alerts.

Filterable tables with search, pagination, clear status labels and responsive
detail views. Avoid charts that do not support a real operational decision.

## 11. Driver experience

Prioritise the next actionable delivery. Each job shows shipment reference,
pickup instructions, delivery destination, contact information needed for the
task and current status.

Confirm consequential status changes. Capture failure reasons. Provide an upload
flow for delivery evidence with progress and retry.

No driver may access another driver's unassigned or unauthorised shipment.

## 12. Responsive behaviour

Minimum 320 px. Mobile: single-column forms, stacked cards, compact navigation.
Tablet: adaptable split views and condensed tables. Desktop: wider dashboards,
side navigation, multi-column summaries. No horizontal page overflow. Touch
targets ideally 44 × 44 CSS px or larger. Responsive images and lazy loading.
Primary actions reachable on mobile without covering content.

## 13. Motion and feedback

Short, purposeful transitions. Button loading states, upload progress, inline
success messages, clear errors. Respect reduced-motion preferences.

Avoid parallax, particle effects, animated background noise, distracting page
transitions, and motion that delays an important task.

## 14. Accessibility

Target WCAG 2.2 AA: visible keyboard focus; proper label and input
associations; semantic headings and landmarks; accessible dialogs and menus;
adequate contrast; status never conveyed by colour alone; screen-reader
announcements for important async updates; keyboard-accessible forms and tables;
reduced-motion support.

## 15. Required design deliverables

1. Responsive public website.
2. Customer booking and tracking screens.
3. Store and checkout screens.
4. Staff and dispatch workspace.
5. Driver workspace.
6. Shared design tokens and component library.
7. Loading, empty, error, success and permission-denied states.
8. Accessible mobile and desktop layouts.
9. A functional navigation map.
10. A screen-by-screen implementation checklist.

All screens must use the shared UI system documented in `UI-SYSTEM.md`.

## 16. Definition of done

A screen is complete only when it matches the approved visual system; works at
320 px, tablet and desktop; every visible control performs its advertised
action; loading, empty, failure and success states exist; forms validate
correctly; permission checks are enforced on the server; accessibility
requirements are met; real application data replaces mock data in production;
and no unsupported operational claims or fabricated data are displayed.