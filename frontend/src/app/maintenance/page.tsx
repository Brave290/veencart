import type { Metadata } from 'next';
import { Wrench } from 'lucide-react';
import { StatusPage } from '@/components/brand/status-page';

/**
 * Maintenance page.
 *
 * Deliberately has NO estimated return time: a made-up ETA is a promise the
 * team did not make. Use this route as the target of a planned maintenance
 * redirect or a hosting-level maintenance rule. `noindex` keeps it out of
 * search results while the site is down for work.
 */
export const metadata: Metadata = {
  title: 'Scheduled maintenance',
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <StatusPage
      eyebrow="Scheduled maintenance"
      title="We are making Veencart better."
      body="The site is briefly unavailable while we carry out planned maintenance. Please try again shortly."
      icon={Wrench}
      tone="orange"
      primary={{ href: '/', label: 'Try the home page' }}
    />
  );
}
