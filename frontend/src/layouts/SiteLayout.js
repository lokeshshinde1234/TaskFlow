import React from 'react';
import SiteFooter from '../components/SiteFooter';
import SiteNavbar from '../components/SiteNavbar';

export default function SiteLayout({ children }) {
  return (
    <div className="tf-mesh-page min-h-screen overflow-hidden bg-[#eef7f5] text-slate-950 dark:bg-slate-950 dark:text-white">
      <SiteNavbar />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
