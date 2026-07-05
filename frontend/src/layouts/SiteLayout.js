import React from 'react';
import SiteFooter from '../components/SiteFooter';
import SiteNavbar from '../components/SiteNavbar';

export default function SiteLayout({ children }) {
  return (
    <div className="tf-mesh-page min-h-screen text-slate-950 dark:text-white">
      <SiteNavbar />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
