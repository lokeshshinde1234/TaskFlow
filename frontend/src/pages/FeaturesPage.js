import React from 'react';
import { ModuleGrid, PublicHero, WorkflowBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';
import usePublicStats from '../hooks/usePublicStats';

export default function FeaturesPage() {
  const { stats } = usePublicStats();

  return (
    <SiteLayout>
      <PublicHero
        eyebrow="Features"
        title="A complete workforce platform, not a static brochure"
        text="The public site now reflects the actual product: authentication, company onboarding, employee management, attendance, live locations, payroll, analytics, and enterprise workflows."
        stats={stats}
      />
      <ModuleGrid />
      <WorkflowBand />
    </SiteLayout>
  );
}
