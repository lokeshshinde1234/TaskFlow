import React from 'react';
import SiteFooter from '../components/SiteFooter';
import SiteNavbar from '../components/SiteNavbar';

export default function SiteLayout({ children }) {
  return (
    <div className="dark tf-mesh-page min-h-screen overflow-hidden bg-slate-950 text-white">
      <SiteNavbar />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
