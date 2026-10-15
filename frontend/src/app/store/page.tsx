import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { StatusPage } from '@/components/brand/status-page';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'The Veencart Logistics marketplace for everyday essentials is coming soon.',
};

export default function StorePage() {
  return (
    <StatusPage
      eyebrow="Marketplace"
      title="The marketplace is coming soon."
      body="Everyday essentials, fulfilled through the same delivery network. No products are listed yet, so there is nothing to buy here today."
      icon={Store}
      points={['Delivery services are open to read about', 'Shipment tracking works with your reference']}
      primary={{ href: '/services', label: 'See delivery services' }}
      secondary={{ href: '/', label: 'Back to home' }}
    />
  );
}
