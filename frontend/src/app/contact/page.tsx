import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { StatusPage } from '@/components/brand/status-page';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach Veencart Logistics. Confirmed contact channels are published here once the business confirms them.',
};

export default function ContactPage() {
  return (
    <StatusPage
      eyebrow="Contact"
      title="Reach us through your shipment reference."
      body="Our confirmed contact channels are still being finalised, so we do not publish a number or address that might be wrong. If you already have a tracking reference, check its status first."
      icon={Mail}
      points={['Shipment status with your tracking reference', 'Service details on each service page']}
      primary={{ href: '/track', label: 'Track a shipment' }}
      secondary={{ href: '/services', label: 'Read the services' }}
    />
  );
}
