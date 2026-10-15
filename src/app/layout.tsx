import type { Metadata, Viewport } from 'next';
import './globals.css';
import './motion.css';

/**
 * Arms the motion system, and only when the user has not asked for reduced
 * motion.
 *
 * This runs as a BLOCKING inline script in <head> — before first paint. That
 * ordering matters: if the class were added by a React effect, the browser
 * would paint the content visible first and then hide it, which is a visible
 * flash. Arming in <head> means the start state is applied before anything is
 * drawn.
 *
 * `dangerouslySetInnerHTML` here is safe and intentional: the string is a
 * compile-time constant with no interpolation and no user input of any kind.
 * It is not a pattern to copy for anything dynamic.
 *
 * The failure mode is the whole design: if this script is blocked, throws, or
 * never runs, `js-reveal-armed` is never added, so nothing is ever hidden and
 * every visitor sees all the content. Motion degrades to stills — content
 * never degrades to blank.
 */
const ARM_MOTION = `try{if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('js-reveal-armed')}}catch(e){}`;

/**
 * Business contact details are deliberately NOT hard-coded here.
 *
 * The live site and the WhatsApp Business listing currently disagree on the
 * phone number and operating hours. Until the business confirms which is
 * authoritative, nothing is published as fact. Contact details are read from
 * the configurable `system_settings` table (and ultimately from confirmed
 * business data), never from a constant in the codebase.
 */

export const metadata: Metadata = {
  title: {
    default: 'Veencart Logistics — Delivery and Commerce',
    template: '%s · Veencart Logistics',
  },
  description:
    'Veencart Logistics handles local and interstate delivery, and runs a marketplace for everyday essentials. Coverage is confirmed per route.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: ARM_MOTION }} />
      </head>
      <body className="min-h-dvh bg-canvas text-content antialiased">{children}</body>
    </html>
  );
}