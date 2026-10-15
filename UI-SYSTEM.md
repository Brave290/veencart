# VEENCART LOGISTICS — UI SYSTEM

**Document:** `UI-SYSTEM.md`
**Version:** 1.0
**Status:** Proposed implementation baseline
**Framework:** Next.js App Router + TypeScript + Tailwind CSS v4
**Accessibility target:** WCAG 2.1 AA (verified by `npm run check:contrast`)
**Minimum viewport:** 320 px

---

## 1. Purpose and authority

This document defines the reusable design tokens, component contracts, layout
rules, interaction patterns, accessibility requirements and implementation
conventions for Veencart Logistics.

`UI-DESIGN.md` defines product visual direction and screen requirements. This
document defines how those requirements must be implemented consistently.

When a screen-specific design conflicts with this system, preserve the intended
user experience while using the shared tokens and components. Document
exceptions rather than silently introducing new styles.

## 2. Technology conventions

- Next.js App Router, React, TypeScript with strict type checking.
- Tailwind CSS v4 — there is **no** `tailwind.config.js`; all theme values live
  in the `@theme` block in `src/app/globals.css`.
- Shared, typed UI components in `src/components/ui/`.
- Zod for form and API input validation.
- Supabase Auth and PostgreSQL.
- Cloudflare R2 for object storage.
- Paystack for payments.
- Vitest for unit/integration tests; Playwright for end-to-end workflows.

Use a compatible component primitive library only when it materially improves
accessibility, and customise its styling to match Veencart. Do not install
multiple overlapping UI libraries.

Keep business logic, server-side data access and presentation components
separate.

## 3. Design tokens

Tokens are CSS custom properties exposed through the Tailwind v4 `@theme` block.

### 3.1 Colour tokens

```css
:root {
  /* Brand */
  --color-brand-900: #0B4F4A;   /* deep teal   — headings, brand surfaces */
  --color-brand-700: #087E67;   /* primary teal— primary action, links     */
  --color-brand-100: #DCEFE8;   /* pale mint   — subtle brand panels       */

  --color-accent-600: #F4773B;  /* brand orange— fills WITH INK TEXT       */
  --color-accent-700: #B2551F;  /* dark orange — fills WITH WHITE TEXT     */
  --color-accent-100: #FFF0E5;  /* pale orange — soft surfaces             */

  /* Surfaces */
  --color-background:     #F7F8F5;
  --color-surface:        #FFFFFF;
  --color-surface-muted:  #F1F4F1;

  /* Text */
  --color-text-primary:   #202927;  /* ink        14.92:1 on white */
  --color-text-secondary: #5F6C68;  /* corrected  5.48:1 on white */
  --color-text-inverse:   #FFFFFF;

  /* Borders and focus */
  --color-border:        #E5E9E5;  /* hairline, decorative only */
  --color-border-strong: #808B87;  /* corrected  3.52:1 — control edges */
  --color-focus:         #087E67;  /* 5.01:1 on white */

  /* Semantic status */
  --color-success-text: #166534;  --color-success-bg: #DCFCE7;  /* 6.49:1 */
  --color-warning-text: #92400E;  --color-warning-bg: #FEF3C7;  /* 6.37:1 */
  --color-danger-text:  #B91C1C;  --color-danger-bg:  #FEE2E2;  /* 5.30:1 */
  --color-info-text:    #1D4ED8;  --color-info-bg:    #DBEAFE;  /* 5.49:1 */
  --color-neutral-text: #475569;  --color-neutral-bg: #F1F5F9;
}
```

#### Corrections applied at implementation

The originally proposed values were verified with `scripts/check-contrast.mjs`
and four pairings failed. The tokens above carry the fixes, each with headroom:

| Original pairing                             | Ratio  | Correction                        | New ratio |
| ------------------------------------------- | ------ | --------------------------------- | --------- |
| `#FFFFFF` on `#F4773B` (orange button)       | 2.78:1 | Ink `#202927` on orange fill      | 5.36:1    |
| `#FFFFFF` on orange fill requiring white text| 2.78:1 | `--color-accent-700` `#B2551F`   | 4.99:1    |
| `#66736F` on `#F1F4F1`                       | 4.46:1 | `--color-text-secondary` `#5F6C68`| 4.95:1   |
| `#B8C3BD` control edge on white              | 1.81:1 | `--color-border-strong` `#808B87` | 3.52:1    |

**Rule:** orange is never a white-text background. Use `--color-accent-600` with
ink text, or `--color-accent-700` with white text. Enforced by
`npm run check:contrast`, which fails the build on regression.

These are initial brand proposals. Reconcile against the supplied logo before
final release.

### 3.2 Colour application rules

- Primary buttons: `--color-brand-700` with white text (5.01:1).
- Deep teal for brand presence — not the background of every section.
- Orange selectively, for promotional highlights and designated secondary actions.
- Default page background is warm white; content cards are white with subtle borders.
- Semantic colours are reserved for the status they actually communicate.
- Never introduce arbitrary colours in individual pages.
- Never rely on colour alone to convey status.

### 3.3 Typography tokens

```css
:root {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --text-xs: 0.75rem;  --text-sm: 0.875rem; --text-base: 1rem;
  --text-lg: 1.125rem; --text-xl: 1.25rem;  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;--text-4xl: 2.25rem; --text-5xl: 3rem;
  --leading-tight: 1.2; --leading-heading: 1.3; --leading-body: 1.6;
}
```

Sentence case for buttons and navigation. Concise headings. Tabular numerals
for prices and operational identifiers. Body copy 16 px by default. Never render
critical information in tiny labels.

### 3.4 Spacing scale

Four-pixel base: `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80` px.
Avoid arbitrary values unless a documented exception requires them.

### 3.5 Radius tokens

```css
:root {
  --radius-sm: 6px;  --radius-control: 9px; --radius-card: 14px;
  --radius-panel: 16px; --radius-dialog: 18px; --radius-pill: 9999px;
}
```

Cards should feel structured, not excessively rounded. Use pill shapes for
compact status indicators, not for every component.

### 3.6 Borders and shadows

```css
:root {
  --border-width: 1px;
  --shadow-card:    0 1px 3px rgb(32 41 39 / 5%);
  --shadow-popover: 0 8px 24px rgb(32 41 39 / 10%);
  --shadow-dialog:  0 16px 48px rgb(32 41 39 / 16%);
}
```

Default cards rely on surface contrast and borders. Shadows are reserved for
elevation, popovers, menus and dialogs.

### 3.7 Layout tokens

```css
:root {
  --container-marketing: 1200px;
  --container-reading: 760px;
  --sidebar-width: 248px;
  --sidebar-collapsed-width: 72px;
  --header-height: 68px;
  --mobile-header-height: 60px;
}
```

## 4. Application layout system

**Public** — header, main content, optional contextual CTA, footer, accessible
mobile navigation. Keep the header lightweight; no permanent overlay obstructing
booking forms.

**Customer** — compact top navigation, account navigation, page heading with
contextual actions, page content, optional mobile bottom navigation. Never show
empty dashboard metrics or invented shipment counts.

**Staff** — sidebar on wide screens, compact header, breadcrumbs where useful,
page heading with primary action, optional KPI summary, filters and search, main
operational table, pagination. On mobile replace the sidebar with an accessible
drawer; tables become compact rows or deliberate container-level scrolling.

**Driver** — compact header with identity, current assignment summary,
prioritised job list, large task actions, status confirmation, evidence section.
One-column, clear instructions, large touch targets. Never bury the next
required action behind decorative panels.

## 5. Component contracts

### 5.1 Button

Variants `primary · secondary · outline · ghost · danger · link`; sizes `sm ·
md · lg`. Visible hover, active, focus, disabled and loading states. Prevent
duplicate submission while pending. Native button semantics; links for
navigation, buttons for actions. Do not simulate disabled with opacity alone.
Never indicate success before the server confirms it.

### 5.2 Text input

Persistent visible label, helper text, inline validation, required/optional
indication, disabled and read-only states, accessible error association,
appropriate autocomplete. Support realistic Nigerian numeric and telephone entry.
Placeholder text is never the only label.

### 5.3 Select and combobox

Native select for short predictable lists; accessible searchable combobox for
long lists such as Nigerian states, cities and service areas. Keyboard
navigation, screen-reader announcements, clear selected value, empty and
loading states. No fabricated locations. Distinguish an unavailable route from
an invalid address.

### 5.4 Date and time controls

Display intended local time clearly. Prevent invalid dates where business rules
are known. Do not hardcode unsupported operating hours. Explain when scheduling
is unavailable. Preserve the selected date if validation fails.

### 5.5 Card

Variants `default · interactive · outlined · muted`. A card must not look
clickable unless the whole surface has a real interaction and keyboard support.

### 5.6 Status badge

Shared semantic mapping; every status has a readable text label **and** a
non-colour signal (glyph). Never treat booking, payment, order and shipment
statuses as interchangeable.

Shipment: Awaiting quote · Awaiting payment · Confirmed · Unassigned · Assigned ·
Picked up · In transit · Out for delivery · Delivered · Delivery failed ·
Exception · Cancelled.

Implemented in `src/components/ui/status-badge.tsx` as a single typed mapping
covering all 16 shipment statuses plus payment and product-order statuses.

### 5.7 Data table

Column headings, sort indicators, search and filtering, pagination, loading
skeleton, empty state, error state, permission-checked row actions, responsive
behaviour, accessible names for icon-only actions. Filter and paginate on the
server; never fetch every record into the browser.

### 5.8 Dialog and confirmation modal

Accessible name and description, keyboard focus management, escape behaviour,
clear cancellation. Destructive actions identify the affected record. Focus
returns to the initiating control. Use a page, not a large modal, for long
multi-step tasks.

### 5.9 Toast and inline feedback

Toasts for non-critical confirmations; persistent inline messages for validation
errors, important warnings and payment/booking exceptions. A toast is never the
only place information needed to recover a failed workflow appears.

### 5.10 Skeleton and loading indicators

Skeletons where final structure is predictable; a spinner for short
action-specific processing. Preserve approximate layout dimensions. Never show
skeletons indefinitely. Provide retry for recoverable failures. Respect
reduced motion.

### 5.11 Pagination

Server-side for operational lists. Preserve filters between pages. Show a result
count only when the actual count is known.

### 5.12 Image and file upload

Validate type and size on client **and** server. Short-lived upload
authorisations from the server. Verify uploaded objects before attaching them to
business records. Separate access policies for public product images and private
delivery evidence. Progress, success, failure and retry states. Never expose
private R2 credentials in browser code.

### 5.13 Form components

Heading and brief explanation, clearly labelled field groups, inline validation,
a visible summary for complex forms, primary submit, secondary cancel, pending
and server-error states. Validate with Zod at the application boundary; server
validation remains authoritative.

## 6. Responsive breakpoints

| Breakpoint | Width      | Behaviour                            |
| ---------- | ---------- | ------------------------------------ |
| Mobile base| 320–639 px | Single column, compact navigation   |
| `sm`       | 640 px     | Wider forms, compact two-column      |
| `md`       | 768 px     | Tablet layouts, optional split views |
| `lg`       | 1024 px    | Desktop navigation and sidebar       |
| `xl`       | 1280 px    | Wider content containers             |
| `2xl`      | 1536 px    | Controlled expansion                 |

Design mobile-first. Verify at 320, 360, 390, 768, 1024, 1280 and 1440 px.

## 7. Interaction and state model

Every data-driven screen must explicitly handle: initial loading; successful
load; empty result; validation error; permission denied; recoverable server
error; pending submission; successful mutation; stale or conflicting data;
offline or interrupted network conditions where relevant.

Use optimistic updates only when rollback is safe. Payment status, inventory
reservation, quote acceptance and shipment completion must be reconciled with
authoritative server state. Never make a failed request appear successful.

## 8. Role-specific interface rules

**Customers** — access only authorised records; guest access uses secure,
limited-scope credentials; clear prices, quote status and payment instructions;
never expose internal notes or another customer's data.

**Staff** — show only permitted actions; distinguish review queues from confirmed
work; confirm destructive or financially consequential operations; display
timestamps and audit references; useful filters for exceptions.

**Dispatchers** — prioritise eligible unassigned shipments; show route and
delivery detail; prevent assignment to ineligible or inactive drivers;
revalidate eligibility server-side; show success only after confirmation.

**Drivers** — access only authorised assigned jobs; confirm important status
changes; capture failure reasons; prevent duplicate completion submissions;
handle poor connectivity without falsely confirming server updates.

**Administrators** — restrict privileged controls; require extra confirmation
for sensitive changes; record role, pricing, refund and security-setting changes
in audit history; never expose privileged API keys in the interface.

## 9. Data presentation rules

**Currency** — Nigerian naira formatting such as `₦12,500.00`, per the product's
chosen precision. Use integer minor units in application logic; never
floating-point arithmetic for money. Never infer a charge from a display value.

**Dates and times** — store UTC, display in `Africa/Lagos`. Label clearly if a
different timezone is used.

**References** — non-sequential public references. Never expose internal database
identifiers as a security mechanism.

**Tables and numbers** — align financial values consistently, use tabular
numerals, and display missing values explicitly rather than inventing defaults.

**Status labels** — keep each workflow's statuses separate. An order may be paid
while its shipment awaits dispatch.

## 10. Navigation and route conventions

```text
/
 /services        /book        /track        /store      /store/[slug]
 /cart            /checkout    /about        /contact    /privacy   /terms

 /auth/sign-in    /auth/sign-up

 /account  /account/bookings  /account/orders  /account/addresses  /account/settings

 /staff  /staff/bookings  /staff/quotes  /staff/shipments  /staff/dispatch
        /staff/drivers  /staff/products /staff/inventory   /staff/orders
        /staff/payments /staff/audit    /staff/settings

 /driver  /driver/deliveries  /driver/deliveries/[id]

 /api/v1/bookings  /api/v1/quotes  /api/v1/shipments  /api/v1/orders
 /api/v1/payments  /api/webhooks/paystack
```

Maintain clear separation between public, customer, staff and driver surfaces.
Authorisation is enforced on the server for protected actions and data.

## 11. Component organisation

```text
src/
  app/ (public) (auth) (customer) (staff) (driver) api/
  components/ui/ button input select dialog badge card table skeleton
                  alert pagination status-badge
  components/layout/ public-header public-footer customer-layout
                     staff-sidebar staff-header driver-layout
  components/ booking tracking marketplace dispatch payments
  lib/ auth permissions validation formatting storage payments
  styles/ tokens.css
  types/
```

A proposed structure, not a requirement to create empty directories. Organise
around actual features. Keep server-only modules separate from browser modules
with explicit boundaries for privileged database access, Paystack keys and
storage signing.

## 12. Performance requirements

Server-render public pages; optimise and size images; lazy-load non-critical
media; avoid shipping unnecessary client JavaScript; keep forms responsive
during requests; paginate large lists; avoid redundant queries; prevent layout
shift from images and skeletons; monitor performance on entry-level Android and
mobile networks.

## 13. Accessibility requirements

Target WCAG 2.1 AA. Semantic HTML; keyboard-accessible interactions; visible
focus indicators; labels and descriptions for form fields; proper heading
hierarchy; accessible names for icon-only buttons; screen-reader announcements
for async changes; adequate contrast; touch targets at least 44 × 44 CSS px;
reduced-motion support; error messages that identify the field and explain
recovery; no keyboard traps; focus restoration after dialogs close.

Automated checks do not replace manual testing.

## 14. Security requirements at the UI boundary

- Never place service-role keys, Paystack secret keys or R2 secret credentials
  in client bundles.
- Treat all client-submitted data as untrusted.
- Enforce server-side permissions for every sensitive action.
- Use RLS as a database protection layer, not a replacement for application
  authorisation.
- Do not rely on hidden navigation links for security.
- Do not trust client-supplied prices, roles, payment results or shipment
  ownership.
- Avoid logging authentication tokens, payment secrets or unnecessary personal
  information.
- Use safe error messages that expose no stack traces or secrets.
- Protect forms and mutation endpoints against duplicate and unauthorised
  requests.
- Use the approved secure guest-access flow for public tracking.
- Rate-limit and abuse-control sensitive public endpoints.

## 15. Testing requirements

**Unit** — token and formatting utilities, currency display, status-to-label
mappings, form validation, permission-based rendering, component states.

**Integration** — booking validation, quote acceptance, server-authorised
shipment transitions, payment verification feedback, product and inventory error
states, upload failure and retry.

**End-to-end** — guest submits a valid booking; unsupported route routes to
manual quote review; a customer sees only authorised tracking information; payment
shows successful only after verification; dispatcher assigns an eligible driver;
driver updates an assigned shipment; marketplace order respects current
inventory; staff without refund permission cannot initiate a refund; mobile
navigation and forms work at 320 px; critical flows remain understandable when
the network fails.

**Visual regression** — representative public, customer, staff and driver screens
at mobile and desktop widths, compared against the approved baseline.

**Contrast** — `npm run check:contrast` runs in CI and fails on regression.

## 16. Design quality gates

A milestone is not complete if: a visible control does nothing; a screen uses
undocumented arbitrary brand colours; loading, empty or failure states are
missing; mobile content overflows horizontally without a deliberate
container-level solution; a protected action relies only on frontend checks; a
payment or shipment status is fabricated; the interface exposes private customer
or driver data; a critical flow cannot be completed by keyboard; a table or form
is unusable on small screens; or mock data remains in a production workflow
without an explicit development-only boundary.

## 17. Final implementation directive

Build Veencart Logistics as a coherent product, not disconnected page designs.

Start with tokens, layout primitives, buttons, form controls, alerts, status
badges, tables and navigation. Implement public pages first, then booking and
tracking, then marketplace, staff operations and driver workspace.

Where business policies remain unconfirmed, build configurable behaviour and
explicitly mark the outstanding decision. Do not silently invent pricing,
payment timing, refund rules, delivery guarantees or operational capabilities.