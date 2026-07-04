import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { DevicePreview, SectionHeader } from '../components/ReactBitsUI';
import { ModuleGrid, TrustBand, WorkflowBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';

export default function AboutPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 md:hidden">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600">
          <FiArrowLeft /> Home
        </Link>
      </div>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div className="flex flex-col justify-center">
          <SectionHeader
            eyebrow="About TaskFlow"
            title="A full-stack operating layer for modern company teams."
            text="TaskFlow brings employee records, secure access, attendance, payroll, client visibility, and field operations into one responsive workspace backed by real API data."
          />
        </div>
        <DevicePreview compact />
      </section>
      <ModuleGrid title="Built around real operating data" text="The public pages now reflect the same modules used by the dashboard and backend." />
      <WorkflowBand />
      <TrustBand />
    </SiteLayout>
  );
}
