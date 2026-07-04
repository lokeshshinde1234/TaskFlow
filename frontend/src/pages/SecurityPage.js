import React from 'react';
import { FiDatabase, FiLock, FiShield, FiZap } from 'react-icons/fi';
import { SectionHeader } from '../components/ReactBitsUI';
import { TrustBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';

const securityItems = [
  [FiLock, 'Authenticated sessions', 'JWT-protected routes, session expiry, logout flows, and role-aware dashboard access.'],
  [FiShield, 'Verified identity', 'Email OTP verification and bcrypt password hashing protect signup and login workflows.'],
  [FiDatabase, 'Scoped data access', 'Founder Admins see company data, employees see their own data, and Super Admin routes stay separate.'],
  [FiZap, 'Production cache path', 'Redis can cache public stats to reduce repeated database work after deployment.'],
];

export default function SecurityPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Security"
          title="Built with the controls a real company portal needs"
          text="The platform already separates public pages from protected workflows and keeps sensitive company operations behind authenticated APIs."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {securityItems.map(([Icon, title, text]) => (
            <article key={title} className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-gradient-to-br from-teal-600 via-blue-600 to-amber-600 text-white">
                <Icon />
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-950 dark:text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <TrustBand />
    </SiteLayout>
  );
}
