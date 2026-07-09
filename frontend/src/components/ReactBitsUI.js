import React from 'react';

export function AuroraScene({ children, className = '' }) {
  return (
    <div className={`relative overflow-hidden bg-[linear-gradient(135deg,#07111f_0%,#0f2f3a_45%,#3b1f3d_100%)] text-white ${className}`}>
      <div className="tf-grid" />
      <div className="tf-aurora tf-aurora-one" />
      <div className="tf-aurora tf-aurora-two" />
      <div className="tf-scanline" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function GlassPanel({ children, className = '' }) {
  return (
    <div className={`rounded-lg border border-white/16 bg-white/[0.10] shadow-hyper backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function KineticButton({ children, className = '', as: Component = 'button', ...props }) {
  return (
    <Component
      className={`tf-kinetic inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold text-white border border-transparent shadow-[0_18px_40px_-20px_rgba(20,184,166,0.85)] transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_24px_50px_-24px_rgba(194,65,12,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/60 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function GhostButton({ children, className = '', as: Component = 'button', ...props }) {
  return (
    <Component
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 font-bold text-white shadow-sm shadow-slate-950/20 transition duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-cyan-300/40 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/40 active:translate-y-0.5 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function StatTile({ icon: Icon, label, value, tone = 'cyan', detail }) {
  const tones = {
    cyan: 'from-cyan-400/20 to-blue-500/10 text-cyan-300',
    green: 'from-emerald-400/20 to-teal-500/10 text-emerald-300',
    amber: 'from-amber-400/20 to-orange-500/10 text-amber-300',
    rose: 'from-rose-400/20 to-fuchsia-500/10 text-rose-300',
  };

  return (
    <GlassPanel className="p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-md bg-gradient-to-br ${tones[tone] || tones.cyan}`}>
        {Icon && <Icon />}
      </div>
      <p className="mt-5 text-3xl font-black tracking-normal">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
      {detail && <p className="mt-3 text-xs text-slate-400">{detail}</p>}
    </GlassPanel>
  );
}

export function DevicePreview({ compact = false }) {
  const rows = ['Onboarding verified', 'Field team active', 'Payroll queued', 'OTP mail delivered'];

  return (
    <GlassPanel className="relative overflow-hidden p-4">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent dark:via-cyan-300" />
      <div className="rounded-md border border-white/10 bg-slate-950/80 p-4 text-white">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <p className="text-xs uppercase text-cyan-200">Live operations</p>
            <p className="text-lg font-black">TaskFlow Command</p>
          </div>
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
        </div>
        <div className={`mt-4 grid gap-3 ${compact ? '' : 'sm:grid-cols-[1fr_0.8fr]'}`}>
          <div className="grid gap-3">
            {rows.map((row, index) => (
              <div key={row} className="tf-float-row flex items-center justify-between rounded-md border border-white/10 bg-white/[0.06] px-3 py-3" style={{ animationDelay: `${index * 120}ms` }}>
                <span className="text-sm text-slate-200">{row}</span>
                <span className="h-2 w-14 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" />
              </div>
            ))}
          </div>
          <div className="relative min-h-52 overflow-hidden rounded-md border border-white/10 bg-[#081827]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(20,184,166,0.24),transparent_26%),radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.22),transparent_30%)]" />
            <div className="absolute left-[18%] top-[18%] h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_30px_rgba(103,232,249,0.9)]" />
            <div className="absolute left-[60%] top-[42%] h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_30px_rgba(110,231,183,0.9)]" />
            <div className="absolute left-[42%] top-[66%] h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_30px_rgba(252,211,77,0.9)]" />
            <div className="absolute inset-x-5 bottom-5 rounded-md border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-300 backdrop-blur">
              37 tracked employees syncing every 60 seconds
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

export function SectionHeader({ eyebrow, title, text, center = false }) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-4xl'}>
      {eyebrow && <p className="text-sm font-black uppercase tracking-wider text-cyan-300">{eyebrow}</p>}
      <h1 className="mt-3 text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl">{title}</h1>
      {text && <p className="mt-5 text-lg leading-8 text-slate-300">{text}</p>}
    </div>
  );
}
