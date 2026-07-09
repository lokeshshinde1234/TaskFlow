import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBriefcase, FiCheckCircle, FiMapPin, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { GhostButton, KineticButton, SectionHeader } from '../ReactBitsUI';
import { productModules, trustPoints, workflowSteps } from '../../data/marketing';

const accentClasses = {
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100 dark:bg-cyan-300/10 dark:text-cyan-200 dark:border-cyan-300/15',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-300/10 dark:text-emerald-200 dark:border-emerald-300/15',
  amber: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-300/10 dark:text-amber-200 dark:border-amber-300/15',
  rose: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-300/10 dark:text-rose-200 dark:border-rose-300/15',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-300/10 dark:text-indigo-200 dark:border-indigo-300/15',
  slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/10',
};

export function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 10000000) return `${(number / 10000000).toFixed(1)}Cr`;
  if (number >= 100000) return `${(number / 100000).toFixed(1)}L`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number);
}

export function PublicHero({ eyebrow, title, text, stats, primaryTo = '/company-onboarding', secondaryTo = '/login' }) {
  const heroStats = [
    { icon: FiBriefcase, label: 'Companies', value: stats.active_companies || stats.total_companies },
    { icon: FiUsers, label: 'Employees', value: stats.active_employees || stats.total_employees },
    { icon: FiMapPin, label: 'Locations', value: stats.tracked_locations },
    { icon: FiTrendingUp, label: 'Attendance records', value: stats.attendance_records },
  ];

  return (
    <section className="border-b border-teal-100/70 bg-[linear-gradient(135deg,rgba(240,253,250,0.9),rgba(236,253,245,0.8),rgba(255,247,237,0.72))] px-4 py-16 backdrop-blur dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.82),rgba(13,42,53,0.72),rgba(54,28,63,0.66))] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl dark:text-white">{title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <KineticButton as={Link} to={primaryTo}>Start workspace <FiArrowRight /></KineticButton>
            <GhostButton as={Link} to={secondaryTo}>Open login</GhostButton>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {heroStats.map(({ icon: Icon, label, value }) => (
            <article key={label} className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-hyper backdrop-blur dark:border-white/10 dark:bg-white/[0.08]">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-gradient-to-br from-teal-600 via-blue-600 to-amber-600 text-white">
                <Icon />
              </div>
              <p className="mt-6 text-4xl font-black text-slate-950 dark:text-white">{formatNumber(value)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">{label}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModuleGrid({ title = 'Core product modules', text = 'Every module is connected to backend records, permissions, and role-specific workflows.' }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Capabilities" title={title} text={text} />
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {productModules.map(({ icon: Icon, title: moduleTitle, text: moduleText, accent }) => (
          <article key={moduleTitle} className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.07]">
            <div className={`grid h-12 w-12 place-items-center rounded-md border ${accentClasses[accent] || accentClasses.cyan}`}>
              <Icon />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-950 dark:text-white">{moduleTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{moduleText}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function WorkflowBand() {
  return (
    <section className="border-y border-teal-100 bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_52%,#fff7ed_100%)] px-4 py-16 text-slate-950 dark:border-teal-300/20 dark:bg-[linear-gradient(135deg,#072326_0%,#123f52_48%,#4a244c_100%)] dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Workflow</p>
          <h2 className="mt-3 text-4xl font-black leading-tight tracking-normal text-slate-950 dark:text-white sm:text-5xl">From onboarding to payroll without switching tools</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">The same company records power employee access, attendance, location, salary, reporting, and admin decisions.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {workflowSteps.map(([step, title, text]) => (
            <article key={step} className="rounded-lg border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur dark:border-white/12 dark:bg-white/[0.09] dark:shadow-hyper">
              <p className="text-sm font-black text-cyan-700 dark:text-cyan-300">{step}</p>
              <h3 className="mt-4 text-lg font-black">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CompanyShowcase({ companies = [] }) {
  const visibleCompanies = companies.length
    ? companies
    : [
        { id: 'sample-1', name: 'Operations HQ', address: 'Live company data appears here after onboarding.', description: 'Register companies to replace this sample with real database records.' },
        { id: 'sample-2', name: 'Field Services', address: 'Attendance, staff counts, and shifts stay connected.', description: 'Public stats are loaded from the FastAPI backend.' },
        { id: 'sample-3', name: 'Payroll Desk', address: 'Salary and attendance data share the same employee records.', description: 'Redis can cache this public view in production.' },
      ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeader eyebrow="Live company data" title="Recently onboarded companies" text="This section is API-backed and updates as real companies are created in TaskFlow." />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {visibleCompanies.map((company) => (
          <article key={company.id || company.name} className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
            <div className="flex items-center gap-4">
              {company.logo_url ? (
                <img src={company.logo_url} alt="" className="h-12 w-12 rounded-md border border-slate-200 bg-white object-contain p-1" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-md bg-gradient-to-br from-teal-600 via-blue-600 to-amber-600 text-white">
                  <FiBriefcase />
                </div>
              )}
              <div>
                <h3 className="font-black text-slate-950 dark:text-white">{company.name}</h3>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">Active workspace</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">{company.description || company.address}</p>
            {(company.start_time || company.end_time) && (
              <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-300">
                {company.start_time || '--:--'} to {company.end_time || '--:--'}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function TrustBand() {
  return (
    <section className="border-y border-teal-100 bg-[linear-gradient(135deg,#f0fdfa_0%,#ecfeff_50%,#fff7ed_100%)] px-4 py-14 dark:border-white/10 dark:bg-[linear-gradient(135deg,#07111f_0%,#111827_60%,#2b1938_100%)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[0.7fr_1.3fr] md:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Production posture</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">Prepared for Railway and GitHub handoff</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {trustPoints.map((point) => (
            <div key={point} className="flex items-start gap-3 rounded-lg border border-teal-100 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
              <FiCheckCircle className="mt-1 shrink-0 text-emerald-500" />
              <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{point}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
