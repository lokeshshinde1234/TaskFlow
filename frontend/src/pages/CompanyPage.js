import React from 'react';
import { CompanyShowcase, ModuleGrid, PublicHero, TrustBand, WorkflowBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';
import usePublicStats from '../hooks/usePublicStats';

export default function CompanyPage() {
  const { stats } = usePublicStats();

  return (
    <SiteLayout>
      <PublicHero
        eyebrow="Company landing"
        title="Run company teams from one professional command workspace"
        text="TaskFlow gives Founder Admins a clean operating layer for onboarding, employee records, attendance, location visibility, salary records, and reporting."
        stats={stats}
      />
      <ModuleGrid title="Company operations, connected end to end" text="Every company page is powered by the same employee, attendance, location, and payroll data used inside the dashboard." />
      <WorkflowBand />
      <CompanyShowcase companies={stats.latest_companies} />
      <TrustBand />
    </SiteLayout>
  );
}
