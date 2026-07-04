import React from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiClock, FiMapPin, FiShield, FiUsers, FiZap } from 'react-icons/fi';
import { AuroraScene, DevicePreview, GhostButton, KineticButton, StatTile } from '../components/ReactBitsUI';
import { CompanyShowcase, ModuleGrid, TrustBand, WorkflowBand } from '../components/marketing/MarketingSections';
import SiteLayout from '../layouts/SiteLayout';
import usePublicStats from '../hooks/usePublicStats';

const metricValue = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0));

export default function LandingPage() {
  const { stats } = usePublicStats();
  const metrics = [
    { label: 'Employees', value: metricValue(stats.active_employees || stats.total_employees), icon: FiUsers, tone: 'cyan', detail: 'Real employee records' },
    { label: 'Locations', value: metricValue(stats.tracked_locations), icon: FiMapPin, tone: 'green', detail: 'GPS updates stored' },
    { label: 'Attendance', value: metricValue(stats.attendance_records), icon: FiClock, tone: 'amber', detail: 'Synced entries' },
    { label: 'Payroll total', value: metricValue(stats.payroll_total), icon: FiBriefcase, tone: 'rose', detail: 'Net salary records' },
  ];

  return (
    <SiteLayout>
      <AuroraScene className="min-h-[720px]">
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[0.95fr_1.05fr] md:py-20 lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100">
              <FiShield /> Secure workforce command center
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
              TaskFlow Employee Management
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              A production-ready workspace for company onboarding, employee access, attendance, live location, payroll, and client-ready operational visibility.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <KineticButton as={Link} to="/company-onboarding" className="w-full justify-center"><FiZap /> Register company</KineticButton>
              <GhostButton as={Link} to="/clients" className="w-full justify-center bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-lg shadow-cyan-500/20">Client view</GhostButton>
            </div>
          </div>

          <div className="grid gap-4">
            <DevicePreview />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {metrics.map((metric) => <StatTile key={metric.label} {...metric} />)}
            </div>
          </div>
        </section>
      </AuroraScene>

      <ModuleGrid />
      <WorkflowBand />
      <CompanyShowcase companies={stats.latest_companies} />
      <TrustBand />
    </SiteLayout>
  );
}
