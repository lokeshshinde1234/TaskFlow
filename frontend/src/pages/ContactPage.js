import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import { GhostButton, KineticButton, SectionHeader } from '../components/ReactBitsUI';
import SiteLayout from '../layouts/SiteLayout';

export default function ContactPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 md:hidden">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300">
          <FiArrowLeft /> Home
        </Link>
      </div>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionHeader
            eyebrow="Contact"
            title="Start managing the company from a real command workspace."
            text="Register a company to create a Founder Admin account, then invite employees into attendance, salary, and location tools."
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <KineticButton as={Link} to="/company-onboarding">Open onboarding</KineticButton>
            <GhostButton as={Link} to="/login">Login</GhostButton>
          </div>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Company contact desk</h2>
          <div className="mt-6 grid gap-4">
            {[
              [FiMail, 'Email', 'support@taskflow.com'],
              [FiPhone, 'Phone', '+91 98765 43210'],
              [FiMapPin, 'Office', 'Business Operations Hub, Bengaluru'],
              [FiBriefcase, 'Deployment', 'Railway-ready FastAPI and React build'],
            ].map(([Icon, label, value]) => (
              <div key={label} className="flex gap-4 rounded-md border border-slate-200 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/35">
                <Icon className="mt-1 text-cyan-700 dark:text-cyan-300" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="font-bold text-slate-950 dark:text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
