import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle } from 'react-icons/fi';
import { GhostButton, KineticButton, SectionHeader } from '../components/ReactBitsUI';
import { pricingPlans } from '../data/marketing';
import SiteLayout from '../layouts/SiteLayout';

export default function PricingPage() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Plans"
          title="Simple packaging for teams at different stages"
          text="TaskFlow is ready to run as a deployable product. These plans frame the same codebase for small teams, growing operations, and enterprise workflows."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {pricingPlans.map((plan) => (
            <article key={plan.name} className="rounded-lg border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.07]">
              <h2 className="text-2xl font-black text-slate-950 dark:text-white">{plan.name}</h2>
              <p className="mt-3 text-3xl font-black text-cyan-700 dark:text-cyan-300">{plan.price}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.text}</p>
              <div className="mt-6 grid gap-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <FiCheckCircle className="text-emerald-500" />
                    {feature}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <KineticButton as={Link} to="/company-onboarding">Create company</KineticButton>
          <GhostButton as={Link} to="/contact">Contact team</GhostButton>
        </div>
      </section>
    </SiteLayout>
  );
}
