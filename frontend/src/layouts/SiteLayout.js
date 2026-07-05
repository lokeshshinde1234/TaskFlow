import React from 'react';
import SiteFooter from '../components/SiteFooter';
import SiteNavbar from '../components/SiteNavbar';

export default function SiteLayout({ children }) {
  return (
    <div className="dark">
      <div className="tf-mesh-page min-h-screen text-white">
        <SiteNavbar />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
