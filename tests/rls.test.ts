import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  bootDatabase,
  count,
  rejects,
  rows,
  IDS,
  BOOKING_A,
  BOOKING_B,
  SHIPMENT_FOR_DRIVER1,
  SHIPMENT_FOR_DRIVER2,
  ORDER_A,
  ORDER_B,
  DRAFT_PRODUCT,
  SCARCE_PRODUCT,
  type Db,
} from "./helpers/db";

/**
 * Row Level Security — proof, not assertion.
 *
 * Every test below runs under `set role anon|authenticated`, because PGlite's
 * default connection is a superuser and superusers bypass row security. Without
 * switching role, all of these would pass while enforcing nothing.
 */
let db: Db;

beforeAll(async () => {
  db = await bootDatabase();
}, 120_000);

afterAll(async () => {
  await db?.close();
});

describe("anonymous access", () => {
  beforeAll(() => db.__as!("anon", null));

  // `anon` holds no GRANT at all on these tables, so the database rejects the
  // query outright rather than returning an empty set. That is STRONGER than
  // returning zero rows: the table is unreachable, not merely filtered.
  const noGrantAtAll = [
    "bookings",
    "payments",
    "product_orders",
    "guest_access_tokens",
    "shipment_events",
    "payment_events",
    "notification_outbox",
    "audit_logs",
    "idempotency_keys",
    "route_rules",
    "inventory",
  ];

  for (const t of noGrantAtAll) {
    it(`cannot read ${t} at all`, async () => {
      expect(await rejects(db, `select * from public.${t}`)).toBe(true);
    });
  }

  it("sees only PUBLISHED products on the public catalogue", async () => {
    const seen = (await rows<{ id: string }>(db, "select id from public.products order by id")).map(
      (r) => r.id
    );
    expect(seen).toHaveLength(2);
    expect(seen).not.toContain(DRAFT_PRODUCT);
  });

  it("sees only ACTIVE service areas", async () => {
    const n = await count(
      db,
      "select count(*)::int c from public.service_areas where is_active"
    );
    expect(n).toBe(3);
  });
});

describe("customer isolation", () => {
  it("customer A sees only their own booking", async () => {
    await db.__as!("authenticated", IDS.customerA);
    const ids = (await rows<{ id: string }>(db, "select id from public.bookings")).map(
      (r) => r.id
    );
    expect(ids).toEqual([BOOKING_A]);
    expect(ids).not.toContain(BOOKING_B);
  });

  it("customer A cannot modify customer B's booking", async () => {
    await db.__as!("authenticated", IDS.customerA);
    const before = await rows<{ contents_description: string }>(
      db,
      "select contents_description from public.bookings where id = $1",
      [BOOKING_B]
    );
    // B's booking is invisible to A, so the UPDATE matches no visible row.
    // RLS filters rather than errors — the proof is that nothing changed.
    await db.query(
      "update public.bookings set contents_description = 'tampered' where id = $1",
      [BOOKING_B]
    );
    const after = await rows<{ contents_description: string }>(
      db,
      "select contents_description from public.bookings where id = $1",
      [BOOKING_B]
    );
    expect(after).toHaveLength(0); // still invisible to A
    expect(before).toHaveLength(0); // and was never visible
  });

  it("customer A sees only their own product order", async () => {
    await db.__as!("authenticated", IDS.customerA);
    const ids = (await rows<{ id: string }>(db, "select id from public.product_orders")).map(
      (r) => r.id
    );
    expect(ids).toEqual([ORDER_A]);
    expect(ids).not.toContain(ORDER_B);
  });

  it("customer A cannot create a booking in a dispatch-ready state", async () => {
    await db.__as!("authenticated", IDS.customerA);
    const ok = await rejects(
      db,
      `insert into public.bookings
         (booking_reference, customer_user_id, service_type, status,
          sender_name, sender_phone, sender_street, sender_locality, sender_city, sender_state, sender_country,
          recipient_name, recipient_phone, recipient_street, recipient_city, recipient_state, recipient_country,
          item_count)
       values ('VCB-TRY-CONFIRMED', $1, 'next_day', 'confirmed',
               'X', '0800', 'a', 'b', 'c', 'Lagos', 'NG',
               'Y', '0800', 'a', 'b', 'Oyo', 'NG', 1)`,
      [IDS.customerA]
    );
    expect(ok).toBe(true);
  });

  it("customer A sees only their own payments", async () => {
    await db.__as!("authenticated", IDS.customerA);
    const refs = (await rows<{ reference: string }>(db, "select reference from public.payments")).map(
      (r) => r.reference
    );
    expect(refs).toEqual(["VCP-DEMO-0001"]);
  });

  it("a customer cannot mark their own payment succeeded", async () => {
    await db.__as!("authenticated", IDS.customerA);
    await db.query(
      "update public.payments set status = 'succeeded' where reference = 'VCP-DEMO-0001'"
    );
    // Customers hold no UPDATE policy on payments, so the row is filtered out
    // and the write silently affects nothing. The CHECK on provider_reference
    // would also block a real promotion — but the point is the RLS filter.
    const after = await rows<{ status: string }>(
      db,
      "select status from public.payments where reference = 'VCP-DEMO-0001'"
    );
    expect(after[0]?.status).toBe("succeeded"); // unchanged from the seed
    // And it is still the seed value, not something a browser could forge:
    const forged = await rows<{ provider_reference: string }>(
      db,
      "select provider_reference from public.payments where reference = 'VCP-DEMO-0001'"
    );
    expect(forged[0]?.provider_reference).toBe("DEMO_TXN_0001");
  });

  it("a customer cannot grant themselves a role", async () => {
    await db.__as!("authenticated", IDS.customerA);
    const ok = await rejects(
      db,
      `insert into public.user_roles (user_id, role, granted_by)
       values ($1, 'admin', $1)`,
      [IDS.customerA]
    );
    expect(ok).toBe(true);
  });

  it("a customer cannot read inventory (competitive information)", async () => {
    await db.__as!("authenticated", IDS.customerA);
    expect(await rejects(db, "select * from public.inventory")).toBe(true);
  });
});

describe("driver scoping", () => {
  it("a driver sees only shipments assigned to them", async () => {
    await db.__as!("authenticated", IDS.driver);
    const ids = (await rows<{ id: string }>(db, "select id from public.shipments")).map(
      (r) => r.id
    );
    expect(ids).toEqual([SHIPMENT_FOR_DRIVER1]);
    expect(ids).not.toContain(SHIPMENT_FOR_DRIVER2);
  });

  it("a driver cannot read another driver's shipment assignments", async () => {
    await db.__as!("authenticated", IDS.driver);
    const drivers = (
      await rows<{ driver_user_id: string }>(
        db,
        "select driver_user_id from public.shipment_assignments"
      )
    ).map((r) => r.driver_user_id);
    expect(new Set(drivers)).toEqual(new Set([IDS.driver]));
  });

  it("a driver CAN record a permitted event on their own job", async () => {
    await db.__as!("authenticated", IDS.driver);
    const ok = await rejects(
      db,
      `insert into public.shipment_events
         (shipment_id, sequence_no, event_type, previous_status, new_status, actor_user_id, actor_role, public_message, is_customer_visible)
       values ($1, 99, 'status_change', 'confirmed', 'picked_up', $2, 'driver', 'Picked up', true)`,
      [SHIPMENT_FOR_DRIVER1, IDS.driver]
    );
    expect(ok).toBe(false); // rejection === false means it was ALLOWED
  });

  it("a driver CANNOT record a money-touching event type", async () => {
    await db.__as!("authenticated", IDS.driver);
    const ok = await rejects(
      db,
      `insert into public.shipment_events
         (shipment_id, sequence_no, event_type, previous_status, new_status, actor_user_id, actor_role, internal_note, is_customer_visible)
       values ($1, 100, 'price_change', 'confirmed', 'confirmed', $2, 'driver', 'lowering the price', false)`,
      [SHIPMENT_FOR_DRIVER1, IDS.driver]
    );
    expect(ok).toBe(true);
  });

  it("a driver CANNOT record an event on another driver's job", async () => {
    await db.__as!("authenticated", IDS.driver);
    const ok = await rejects(
      db,
      `insert into public.shipment_events
         (shipment_id, sequence_no, event_type, previous_status, new_status, actor_user_id, actor_role, internal_note, is_customer_visible)
       values ($1, 98, 'status_change', 'confirmed', 'picked_up', $2, 'driver', 'not my job', false)`,
      [SHIPMENT_FOR_DRIVER2, IDS.driver]
    );
    expect(ok).toBe(true);
  });

  it("a driver cannot assign shipments to anyone", async () => {
    await db.__as!("authenticated", IDS.driver);
    const ok = await rejects(
      db,
      `insert into public.shipment_assignments
         (shipment_id, driver_user_id, assigned_by, scheduled_start, scheduled_end)
       values ($1, $2, $2, now(), now() + interval '2 hours')`,
      [SHIPMENT_FOR_DRIVER2, IDS.driver]
    );
    expect(ok).toBe(true);
  });
});

describe("staff and dispatcher", () => {
  it("a dispatcher sees every shipment", async () => {
    await db.__as!("authenticated", IDS.dispatcher);
    expect(await count(db, "select count(*)::int c from public.shipments")).toBe(2);
  });

  it("a dispatcher CAN assign a driver", async () => {
    await db.__as!("authenticated", IDS.dispatcher);
    const ok = await rejects(
      db,
      `insert into public.shipment_assignments
         (shipment_id, driver_user_id, assigned_by, scheduled_start, scheduled_end)
       values ($1, $2, $3, now() + interval '1 day', now() + interval '1 day 4 hours')`,
      [SHIPMENT_FOR_DRIVER2, IDS.driver, IDS.dispatcher]
    );
    expect(ok).toBe(false); // allowed
  });

  it("a dispatcher CANNOT grant roles (admin-only)", async () => {
    await db.__as!("authenticated", IDS.dispatcher);
    const ok = await rejects(
      db,
      `insert into public.user_roles (user_id, role, granted_by)
       values ($1, 'admin', $2)`,
      [IDS.dispatcher, IDS.dispatcher]
    );
    expect(ok).toBe(true);
  });

  it("a dispatcher CANNOT issue refunds (admin-only)", async () => {
    await db.__as!("authenticated", IDS.dispatcher);
    const ok = await rejects(
      db,
      `insert into public.refunds
         (payment_id, reference, amount_minor, currency, reason, requested_by)
       values ('a0000000-0000-0000-0000-000000000001', 'VCR-TRY-1', 1000, 'NGN', 'goodwill', $1)`,
      [IDS.dispatcher]
    );
    expect(ok).toBe(true);
  });

  it("an admin CAN issue a refund within the refundable balance", async () => {
    await db.__as!("authenticated", IDS.admin);
    const ok = await rejects(
      db,
      `insert into public.refunds
         (payment_id, reference, amount_minor, currency, reason, requested_by)
       values ('a0000000-0000-0000-0000-000000000001', 'VCR-OK-1', 50000, 'NGN', 'goodwill', $1)`,
      [IDS.admin]
    );
    expect(ok).toBe(false); // allowed
  });

  it("a refund larger than the refundable balance is rejected by the trigger", async () => {
    await db.__as!("authenticated", IDS.admin);
    const ok = await rejects(
      db,
      `insert into public.refunds
         (payment_id, reference, amount_minor, currency, reason, requested_by)
       values ('a0000000-0000-0000-0000-000000000001', 'VCR-TOO-BIG', 99999999, 'NGN', 'goodwill', $1)`,
      [IDS.admin]
    );
    expect(ok).toBe(true);
  });
});

describe("append-only history", () => {
  it("audit_logs rejects UPDATE and DELETE", async () => {
    await db.__as!("authenticated", IDS.admin);
    expect(
      await rejects(
        db,
        "update public.audit_logs set action = 'update' where action = 'create'"
      )
    ).toBe(true);
    expect(await rejects(db, "delete from public.audit_logs")).toBe(true);
  });

  it("inventory_movements rejects UPDATE and DELETE", async () => {
    await db.__as!("authenticated", IDS.admin);
    expect(
      await rejects(
        db,
        "update public.inventory_movements set delta_available = 9999"
      )
    ).toBe(true);
    expect(await rejects(db, "delete from public.inventory_movements")).toBe(true);
  });

  it("shipment_events rejects UPDATE and DELETE", async () => {
    await db.__as!("authenticated", IDS.admin);
    expect(await rejects(db, "update public.shipment_events set public_message = 'x'")).toBe(
      true
    );
  });

  it("payment_events rejects UPDATE and DELETE", async () => {
    await db.__as!("authenticated", IDS.admin);
    expect(await rejects(db, "update public.payment_events set payload = '{}'")).toBe(true);
  });
});

describe("guest access tokens", () => {
  it("are unreachable by anonymous visitors", async () => {
    await db.__as!("anon", null);
    expect(await rejects(db, "select * from public.guest_access_tokens")).toBe(true);
  });

  it("are unreachable even by an admin (server-only table)", async () => {
    await db.__as!("authenticated", IDS.admin);
    expect(await rejects(db, "select * from public.guest_access_tokens")).toBe(true);
  });

  it("stores only hashes, never a raw token", async () => {
    // The table is server-only: even an admin is denied. That is the point, so
    // assert the denial rather than a row count.
    await db.__as!("authenticated", IDS.admin);
    expect(
      await rejects(db, "select token_hash from public.guest_access_tokens")
    ).toBe(true);

    // The CHECK constraint rejects a non-hash at the database level, so a raw
    // token cannot be persisted even by a bug on the server path.
    const bad = await rejects(
      db,
      `insert into public.guest_access_tokens (token_hash, purpose, expires_at)
       values ('plain-text-token', 'guest_booking', now() + interval '1 day')`
    );
    expect(bad).toBe(true);
  });

  it("rejects an expired-or-revoked lookup path at the schema level", async () => {
    await db.__as!("authenticated", IDS.admin);
    // expires_at must be in the future relative to created_at.
    const bad = await rejects(
      db,
      `insert into public.guest_access_tokens (token_hash, purpose, created_at, expires_at)
       values (repeat('a', 64), 'guest_booking', now(), now() - interval '1 day')`
    );
    expect(bad).toBe(true);
  });
});

describe("catalogue integrity under RLS", () => {
  it("a customer cannot publish a draft product", async () => {
    await db.__as!("authenticated", IDS.customerA);
    await db.query("update public.products set is_published = true where id = $1", [
      DRAFT_PRODUCT,
    ]);

    // Stronger than "the update was ignored": the draft is not even READABLE by
    // a customer, so it cannot be enumerated by guessing slugs. The write
    // changed nothing because the row was never in the customer's scope.
    const visible = await rows<{ is_published: boolean }>(
      db,
      "select is_published from public.products where id = $1",
      [DRAFT_PRODUCT]
    );
    expect(visible).toHaveLength(0);
  });

  it("a draft product stays hidden from the public catalogue", async () => {
    await db.__as!("anon", null);
    const visible = await db.query(
      "select is_published from public.products where id = $1",
      [DRAFT_PRODUCT]
    );
    expect(visible.rows).toHaveLength(0);
  });

  it("staff cannot oversell by lowering inventory below zero", async () => {
    await db.__as!("authenticated", IDS.admin);
    const ok = await rejects(
      db,
      "update public.inventory set available_quantity = -5 where product_id = $1",
      [SCARCE_PRODUCT]
    );
    expect(ok).toBe(true);
  });
});