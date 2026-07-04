import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMoreVertical, FiX, FiArrowRight } from 'react-icons/fi';

export default function MobileDotsPanel({ title, subtitle, tips = [], actions = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white p-3 text-slate-800 shadow-md transition hover:bg-slate-50 dark:border-white/20 dark:bg-slate-950/90 dark:text-white dark:hover:bg-slate-900"
        aria-label="Open quick mobile actions"
      >
        {open ? <FiX className="h-5 w-5" /> : <FiMoreVertical className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[92vw] max-w-sm rounded-3xl border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">{title || 'Quick actions'}</p>
              {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-white/10 p-2 text-slate-200 hover:bg-white/15">
              <FiX className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {tips.map((tip) => (
              <div key={tip.title} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-slate-100">{tip.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{tip.description}</p>
              </div>
            ))}

            {actions.length > 0 && (
              <div className="grid gap-2">
                {actions.map((action) => {
                  const className = 'inline-flex items-center justify-between rounded-2xl border border-white/10 bg-cyan-600/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-600/20';
                  if (action.onClick) {
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          action.onClick();
                        }}
                        className={className}
                      >
                        <span>{action.label}</span>
                        <FiArrowRight className="h-4 w-4" />
                      </button>
                    );
                  }
                  return (
                    <Link
                      key={action.label}
                      to={action.to}
                      onClick={() => setOpen(false)}
                      className={className}
                    >
                      <span>{action.label}</span>
                      <FiArrowRight className="h-4 w-4" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
