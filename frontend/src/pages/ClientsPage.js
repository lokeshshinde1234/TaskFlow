import React from 'react';
import { CompanyShowcase, PublicHero, TrustBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';
import usePublicStats from '../hooks/usePublicStats';

export default function ClientsPage() {
  const { stats } = usePublicStats();

  return (
    <SiteLayout>
      <PublicHero
        eyebrow="Client landing"
        title="Client-ready visibility into active teams and work status"
        text="Show clients a confident operational front: active companies, employee scale, attendance activity, and location-backed field visibility from real backend records."
        stats={stats}
        primaryTo="/contact"
        secondaryTo="/services"
      />
      <CompanyShowcase companies={stats.latest_companies} />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['Verified operations', 'Attendance and employee status come from the live application database.'],
            ['Field confidence', 'Location records support better transparency for distributed teams.'],
            ['Clean reporting', 'Payroll, attendance, and workforce totals are prepared for executive review.'],
          ].map(([title, text]) => (
            <article key={title} className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <TrustBand />
    </SiteLayout>
  );
}
