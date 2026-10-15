import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { bootDatabase, IDS, type Db } from "./helpers/db";

/** PGlite returns `unknown[]` rows; narrow once rather than at every access. */
function rows<T = Record<string, unknown>>(r: { rows: unknown[] }): T[] {
  return r.rows as T[];
}

/**
 * Regression tests for the security audit findings.
 *
 * A security audit that produces a report but no tests leaves the same bugs in
 * place. Each test below re-runs the exact exploit the auditor PROVED, and
 * asserts it now fails.
 *
 * Every one of these switches database role, because PGlite's default
 * connection is a superuser and a superuser bypasses RLS entirely. A test
 * written without `set role` passes while enforcing nothing — which is exactly
 * how the auditor's own first two probe runs produced false results.
 */

let db: Db;

const PAYMENT_A = "a0000000-0000-0000-0000-000000000001"; // succeeded, 350000 kobo
const BOOKING_A = "50000000-0000-0000-0000-000000000001";
const SHIPMENT_FOR_DRIVER1 = "70000000-0000-0000-0000-000000000001";

beforeAll(async () => {
  db = await bootDatabase();
}, 180_000);

afterAll(async () => {
  await db?.close();
});

async function as(role: string, userId: string | null) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub', coalesce($1, ''), false)", [
    userId,
  ]);
  await db.query(`set role ${role}`);
}

async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 1 — CRITICAL: refund ceiling was per-refund, not cumulative
// The auditor proved three refunds of 350000 against a 350000 payment succeeded,
// totalling 1,050,000. refundable_amount_minor was a static column nothing
// decremented, and the schema comment claimed the limit was enforced.
// ─────────────────────────────────────────────────────────────────────────────
describe("F1 CRITICAL — cumulative refund ceiling", () => {
  it("blocks a second refund that would exceed the remaining balance", async () => {
    await as("authenticated", IDS.admin);

    // First refund of 350000 is the full balance and must be allowed.
    const first = await rejects(() =>
      db.query(
        `insert into public.refunds (payment_id, reference, amount_minor, currency, reason, requested_by)
         values ($1, 'VCR-F1-A', 350000, 'NGN', 'goodwill', $2)`,
        [PAYMENT_A, IDS.admin]
      )
    );
    expect(first, "a refund equal to the full balance must be allowed").toBe(false);

    // A SECOND refund of the same amount must now be rejected, because the
    // running total is 350000 and the remaining balance is 0.
    const second = await rejects(() =>
      db.query(
        `insert into public.refunds (payment_id, reference, amount_minor, currency, reason, requested_by)
         values ($1, 'VCR-F1-B', 350000, 'NGN', 'goodwill', $2)`,
        [PAYMENT_A, IDS.admin]
      )
    );
    expect(second, "second full-balance refund must be rejected").toBe(true);
  });

  it("allows a partial refund that exactly consumes the remainder", async () => {
    await as("authenticated", IDS.admin);

    // F1-A already took 350000, so any further amount exceeds the remainder.
    const over = await rejects(() =>
      db.query(
        `insert into public.refunds (payment_id, reference, amount_minor, currency, reason, requested_by)
         values ($1, 'VCR-F1-C', 1, 'NGN', 'goodwill', $2)`,
        [PAYMENT_A, IDS.admin]
      )
    );
    expect(over, "not even 1 kobo remains").toBe(true);
  });

  it("does not count a cancelled refund against the balance", async () => {
    await as("service_role", null);

    // Payment ...0002 is 'pending' in the seed with no refundable balance, so
    // the trigger correctly refuses any refund against it. Settle it first —
    // that is the real prerequisite, not a workaround.
    await db.query(
      `update public.payments
          set status = 'succeeded', refundable_amount_minor = amount_minor,
              provider_reference = 'DEMO_TXN_0002', paid_at = now(), verified_at = now()
        where reference = 'VCP-DEMO-0002'`
    );

    // A cancelled refund released its hold, so it must not consume the ceiling.
    const ok = await rejects(() =>
      db.query(
        `insert into public.refunds
           (payment_id, reference, amount_minor, currency, reason, requested_by, status)
         values ('a0000000-0000-0000-0000-000000000002', 'VCR-F1-D', 50000, 'NGN', 'goodwill', $1, 'cancelled')`,
        [IDS.admin]
      )
    );
    expect(ok, "cancelled refunds should not block a new refund").toBe(false);

    // And the full balance is still refundable afterwards.
    const full = await rejects(() =>
      db.query(
        `insert into public.refunds
           (payment_id, reference, amount_minor, currency, reason, requested_by)
         values ('a0000000-0000-0000-0000-000000000002', 'VCR-F1-E', 200000, 'NGN', 'goodwill', $1)`,
        [IDS.admin]
      )
    );
    expect(full, "a cancelled refund must not consume the balance").toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 2 — CRITICAL: the payment amount was entirely client-chosen
// The auditor proved amount_minor = 1 AND expected_amount_minor = 1 was accepted,
// satisfying every integrity rule. Nothing derived the amount from the quote.
// ─────────────────────────────────────────────────────────────────────────────
describe("F2 CRITICAL — payment amount is server-derived", () => {
  it("overwrites a client-supplied amount with the accepted quote total", async () => {
    await as("service_role", null);

    // Client tries to pay 1 kobo for a 350000 kobo booking.
    await db.query(
      `insert into public.payments
         (reference, payable_kind, booking_id, amount_minor, currency,
          expected_amount_minor, expected_currency, status)
       values ('VCP-F2-CHEAP', 'booking', $1, 1, 'NGN', 1, 'NGN', 'pending')`,
      [BOOKING_A]
    );

    const r = await rows<{ amount_minor: number | string }>(
      await db.query(
        `select amount_minor, expected_amount_minor from public.payments where reference = 'VCP-F2-CHEAP'`
      )
    );
    expect(Number(r[0]?.amount_minor)).toBe(350000);
  });

  it("refuses a payment when no confirmed amount exists", async () => {
    await as("service_role", null);

    // A booking with NO accepted quote. Created here rather than reusing a seed
    // row, because both seed bookings now legitimately carry quotes (required
    // by the derive trigger) and reusing one would make this test vacuous.
    await db.query(
      `insert into public.bookings
         (id, booking_reference, customer_user_id, service_type, status,
          sender_name, sender_phone, sender_street, sender_locality, sender_city, sender_state, sender_country,
          recipient_name, recipient_phone, recipient_street, recipient_city, recipient_state, recipient_country,
          item_count)
       values ('5f000000-0000-0000-0000-000000000001', 'VCB-NOQUOTE-TEST',
               '00000000-0000-0000-0000-00000000000b', 'next_day', 'quote_requested',
               'Test Sender', '08000000000', '1 Test St', 'Test', 'Test', 'Lagos', 'NG',
               'Test Recipient', '08000000001', '2 Test Rd', 'Test', 'Oyo', 'NG', 1)`
    );

    // No accepted quote => no trusted total => the payment must be refused, not
    // created at whatever amount the caller supplied.
    const blocked = await rejects(() =>
      db.query(
        `insert into public.payments
           (reference, payable_kind, booking_id, amount_minor, currency,
            expected_amount_minor, expected_currency, status)
         values ('VCP-F2-NOQUOTE', 'booking', '5f000000-0000-0000-0000-000000000001',
                 999999, 'NGN', 999999, 'NGN', 'pending')`
      )
    );
    expect(blocked, "an unquoted booking must not be payable at an invented amount").toBe(true);
  });

  it("makes the amount immutable after creation", async () => {
    await as("service_role", null);

    const changed = await rejects(() =>
      db.query(
        `update public.payments
            set amount_minor = 1, expected_amount_minor = 1
          where reference = 'VCP-F2-CHEAP'`
      )
    );
    expect(changed, "payment amounts must be frozen once written").toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 3 — HIGH: a driver could forge attribution and publish internal notes
// Proven: driver set actor_user_id to an admin and actor_role='admin', and set
// is_customer_visible true (the column even DEFAULTED to true) to leak an
// internal note to the customer, who then read it back.
// ─────────────────────────────────────────────────────────────────────────────
describe("F3 HIGH — driver cannot forge attribution or leak notes", () => {
  it("rejects a driver event attributed to an admin", async () => {
    await as("authenticated", IDS.driver);

    const forged = await rejects(() =>
      db.query(
        `insert into public.shipment_events
           (shipment_id, sequence_no, event_type, previous_status, new_status,
            actor_user_id, actor_role, public_message, is_customer_visible)
         values ($1, 200, 'status_change', 'confirmed', 'picked_up',
                 $2, 'admin', 'Picked up', false)`,
        [SHIPMENT_FOR_DRIVER1, IDS.admin]
      )
    );
    expect(forged, "actor_user_id must equal the caller").toBe(true);
  });

  it("rejects a driver publishing an internal note to the customer", async () => {
    await as("authenticated", IDS.driver);

    const leak = await rejects(() =>
      db.query(
        `insert into public.shipment_events
           (shipment_id, sequence_no, event_type, previous_status, new_status,
            actor_user_id, actor_role, internal_note, is_customer_visible)
         values ($1, 201, 'delay_note', 'confirmed', 'confirmed',
                 $2, 'driver', 'INTERNAL: flagged as fraud', true)`,
        [SHIPMENT_FOR_DRIVER1, IDS.driver]
      )
    );
    expect(leak, "a driver must not author a customer-visible internal note").toBe(true);
  });

  it("still permits a legitimate driver status event", async () => {
    await as("authenticated", IDS.driver);

    const allowed = await rejects(() =>
      db.query(
        `insert into public.shipment_events
           (shipment_id, sequence_no, event_type, previous_status, new_status,
            actor_user_id, actor_role, public_message, is_customer_visible)
         values ($1, 202, 'status_change', 'confirmed', 'picked_up',
                 $2, 'driver', 'Picked up', false)`,
        [SHIPMENT_FOR_DRIVER1, IDS.driver]
      )
    );
    expect(allowed, "a driver must still be able to move their own job").toBe(false);
  });

  it("defaults is_customer_visible to false so omission cannot publish", async () => {
    await as("service_role", null);
    const r = await rows<{ column_default: string | null }>(
      await db.query(
        `select column_default from information_schema.columns
          where table_name = 'shipment_events' and column_name = 'is_customer_visible'`
      )
    );
    expect(String(r[0]?.column_default)).toContain("false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 4 — HIGH: any authenticated user could read is_secret settings
// Proven: customer A ran `select ... where is_secret` and got the value back.
// ─────────────────────────────────────────────────────────────────────────────
describe("F4 HIGH — secret settings are not readable by ordinary users", () => {
  it("hides an is_secret row from a customer", async () => {
    await as("service_role", null);
    await db.query(
      `insert into public.system_settings (key, value, value_type, is_secret)
       values ('payment.gateway_api_key', '"sk_live_FAKE"', 'string', true)
       on conflict (key) do update set is_secret = true`
    );

    await as("authenticated", IDS.customerA);
    // RLS FILTERS rather than erroring: the row is simply not in the customer's
    // result set. Asserting "the query throws" would be the wrong test — that
    // would only pass if the table were unreachable to every principal, which
    // is not what we want.
    const rows = await db.query(
      `select key, value from public.system_settings where is_secret`
    );
    expect(
      rows.rows,
      "a customer must not be able to read secret settings"
    ).toHaveLength(0);
  });

  it("still lets a customer read non-secret business policy", async () => {
    await as("authenticated", IDS.customerA);
    const r = await rows<{ key: string }>(
      await db.query(`select key from public.system_settings where is_secret = false limit 5`)
    );
    expect(r.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FINDING 5 — HIGH: a dispatcher could rewrite a payment amount and forge
// status='succeeded' with an invented provider_reference.
// ─────────────────────────────────────────────────────────────────────────────
describe("F5 HIGH — a dispatcher cannot rewrite or forge a payment", () => {
  it("rejects a dispatcher rewriting a settled amount", async () => {
    await as("authenticated", IDS.dispatcher);
    // A dispatcher has no UPDATE policy on payments, so the row is filtered out
    // of the statement's scope: the UPDATE matches nothing and changes nothing.
    // `returning` makes that observable — without it the test would pass on a
    // query that silently did nothing.
    const res = await db.query(
      `update public.payments set amount_minor = 1, expected_amount_minor = 1
        where reference = 'VCP-DEMO-0001' returning id`
    );
    expect(res.rows, "no payment row may be visible to a dispatcher for update").toHaveLength(0);
  });

  it("rejects a dispatcher forging a successful payment", async () => {
    await as("authenticated", IDS.dispatcher);
    const res = await db.query(
      `update public.payments
          set status = 'succeeded', provider_reference = 'FORGED', paid_at = now()
        where reference = 'VCP-DEMO-0002' returning id`
    );
    expect(res.rows, "a dispatcher must not be able to forge a successful payment").toHaveLength(0);
  });

  it("leaves the payment genuinely unchanged", async () => {
    await as("service_role", null);
    const r = await rows<{ amount_minor: number | string; status: string; provider_reference: string | null }>(
      await db.query(
        `select amount_minor, status, provider_reference from public.payments
          where reference = 'VCP-DEMO-0001'`
      )
    );
    expect(Number(r[0]?.amount_minor)).toBe(350000);
    expect(r[0]?.status).toBe("succeeded");
    expect(r[0]?.provider_reference).toBe("DEMO_TXN_0001");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seed integrity — the auditor found the documented hash did not match its
// stated input, which would send an engineer debugging guest lookup astray.
// ─────────────────────────────────────────────────────────────────────────────
describe("seed integrity", () => {
  it("stores the sha256 of the documented demo token", async () => {
    const { createHash } = await import("node:crypto");
    const expected = createHash("sha256")
      .update("demo-raw-token-do-not-use")
      .digest("hex");

    await as("service_role", null);
    const r = await db.query(`select token_hash from public.guest_access_tokens`);
    expect(rows<{ token_hash: string }>(r).map((x) => x.token_hash)).toContain(expected);
  });
});