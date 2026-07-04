import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { ModuleGrid, WorkflowBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';

export default function ServicesPage() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 md:hidden">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600">
          <FiArrowLeft /> Home
        </Link>
      </div>
      <ModuleGrid title="Services that match the real dashboard" text="Each service maps to a concrete workflow already present in the app: employees, attendance, location, salary, analytics, and enterprise operations." />
      <WorkflowBand />
    </SiteLayout>
  );
}
