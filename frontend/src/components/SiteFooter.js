import React from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowRight } from 'react-icons/fi';

export default function SiteFooter() {
  return (
    <footer className="border-t border-teal-100 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_48%,#fff7ed_100%)] px-4 py-12 text-sm text-slate-600 dark:border-white/10 dark:bg-[linear-gradient(135deg,#050b16_0%,#071827_55%,#17111f_100%)] dark:text-slate-300 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-teal-600 via-blue-600 to-amber-600 text-white"><FiActivity /></span>
            TaskFlow
          </Link>
          <p className="mt-4 max-w-sm leading-6">
            Full-stack workforce operations for company onboarding, attendance, location, payroll, clients, and enterprise workflows.
          </p>
          <Link to="/company-onboarding" className="mt-5 inline-flex items-center gap-2 font-black text-cyan-700 dark:text-cyan-300">
            Create company <FiArrowRight />
          </Link>
        </div>
        <FooterColumn title="Product" links={[['Features', '/features'], ['Services', '/services'], ['Pricing', '/pricing'], ['Security', '/security']]} />
        <FooterColumn title="Solutions" links={[['Companies', '/companies'], ['Clients', '/clients'], ['Onboarding', '/company-onboarding'], ['Employee signup', '/signup']]} />
        <FooterColumn title="Company" links={[['About', '/about'], ['Contact', '/contact'], ['Login', '/login'], ['Home', '/']]} />
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>TaskFlow Employee Management</p>
        <p>FastAPI, React, Railway, and Redis-ready public stats.</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }) {
  return (
    <div>
      <h2 className="font-black text-slate-950 dark:text-white">{title}</h2>
      <div className="mt-4 grid gap-3">
        {links.map(([label, to]) => (
          <Link key={to} to={to} className="transition hover:text-cyan-700 dark:hover:text-cyan-300">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
