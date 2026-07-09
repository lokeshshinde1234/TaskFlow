import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiActivity, FiMoreVertical, FiX } from 'react-icons/fi';
import { KineticButton } from './ReactBitsUI';

const navItems = [
  { label: 'Companies', to: '/companies' },
  { label: 'Clients', to: '/clients' },
  { label: 'Features', to: '/features' },
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Contact', to: '/contact' },
];

export default function SiteNavbar() {
  const [open, setOpen] = useState(false);
  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition ${
      isActive ? 'text-cyan-300' : 'text-slate-300 hover:text-cyan-200'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/88 text-white backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-xl font-black">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-teal-600 via-blue-600 to-amber-600 text-white shadow-sm"><FiActivity /></span>
          TaskFlow
        </Link>
        <div className="hidden items-center gap-4 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
          <KineticButton as={Link} to="/company-onboarding" className="px-4 py-2 text-sm">Onboard</KineticButton>
          <KineticButton as={Link} to="/login" className="px-4 py-2 text-sm">Login</KineticButton>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-white/15 bg-white/10 p-2 text-white md:hidden">
          {open ? <FiX /> : <FiMoreVertical />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-white/10 bg-slate-950/95 px-4 py-4 backdrop-blur md:hidden">
          <div className="grid gap-3">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            <KineticButton as={Link} to="/company-onboarding" className="px-4 py-2">Company onboarding</KineticButton>
            <KineticButton as={Link} to="/login" className="px-4 py-2">Login</KineticButton>
          </div>
        </div>
      )}
    </header>
  );
}
