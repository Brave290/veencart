import type { Metadata } from 'next';
import { CalendarClock } from 'lucide-react';
import { StatusPage } from '@/components/brand/status-page';

export const metadata: Metadata = {
  title: 'Book a delivery',
  description: 'Booking a Veencart delivery. Online booking is being set up; available services and tracking are listed here.',
};

export default function BookPage() {
  return (
    <StatusPage
      eyebrow="Booking"
      title="Online booking is being set up."
      body="We are not taking online bookings yet, so nothing is quoted or charged here. Read what each service includes first, and track any shipment you already have a reference for."
      icon={CalendarClock}
      points={[
        'Read what each delivery service includes',
        'Track a shipment with your reference',
        'Coverage is confirmed per route before any booking is made',
      ]}
      primary={{ href: '/services', label: 'Explore services' }}
      secondary={{ href: '/track', label: 'Track a shipment' }}
    />
  );
}
