import type { Metadata } from 'next';

import { BookingForm } from './booking-form';

export const metadata: Metadata = {
  title: 'Book a delivery',
  description:
    'Request a parcel delivery with Veencart. Tell us the pickup and drop-off addresses, the service you need and what you are sending.',
};

/**
 * The booking page.
 *
 * Deliberately a thin server component: all state lives in the form, and the
 * submission goes through a server action. Nothing here touches the database,
 * so the page is statically prerenderable and cannot fail at render time.
 */
export default function BookPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-content sm:text-4xl">
          Request a delivery
        </h1>
        <p className="mt-3 max-w-2xl text-base text-content-muted">
          Tell us where the parcel is going and what is in it. We confirm the
          price with you before anything is charged, and we arrange collection by
          phone — you do not need an account to book.
        </p>
      </header>

      <BookingForm />
    </div>
  );
}