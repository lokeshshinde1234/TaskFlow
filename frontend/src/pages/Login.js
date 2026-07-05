import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEye, FiEyeOff, FiLock, FiMail, FiShield } from 'react-icons/fi';
import { AuroraScene, DevicePreview, GhostButton, KineticButton } from '../components/ReactBitsUI';
import { AuthContext } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { getLoginRedirectPath } from '../utils/roles';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useContext(AuthContext);
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [authMessage, setAuthMessage] = useState(location.state?.message || sessionStorage.getItem('auth_message') || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setAuthMessage('');
    sessionStorage.removeItem('auth_message');
    setLoading(true);
    try {
      const response = await authAPI.login(form.email, form.password);
      login(response.data);
      navigate(getLoginRedirectPath(form.email, response.data));
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuroraScene className="min-h-screen px-4 py-10">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl overflow-hidden rounded-lg border border-white/70 bg-white/75 shadow-hyper backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.08] md:grid-cols-2">
          <section className="hidden p-8 text-slate-950 dark:text-white md:flex md:flex-col md:justify-between">
            <Link to="/" className="text-2xl font-black">TaskFlow</Link>
            <div className="grid gap-6">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100"><FiShield /> Role-secure access</p>
                <h1 className="text-4xl font-black leading-tight">Secure access for every role.</h1>
                <p className="mt-4 text-slate-600 dark:text-slate-300">Employees use attendance tools. Founder Admins manage one company. Super Admins oversee every registered company.</p>
              </div>
              <DevicePreview compact />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">JWT protected routes with bcrypt password verification.</p>
          </section>

          <section className="flex items-center border-l border-slate-200 bg-white/95 p-6 text-slate-950 shadow-[inset_1px_0_0_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 dark:text-white sm:p-10">
            <div className="w-full">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100">
                  <FiArrowLeft /> Home
                </Link>
              </div>
              <Link to="/" className="mb-4 block text-2xl font-black md:hidden">TaskFlow</Link>
              <h2 className="text-3xl font-black text-slate-950 dark:text-white">Login</h2>
              <p className="mt-2 text-slate-600 dark:text-slate-300">Company admins open the workspace to add and manage employees.</p>

              <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
                {authMessage && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200">
                    {authMessage}
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-200">
                    {error}
                  </div>
                )}

              <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Email address
                <span className="tf-form-field flex min-h-11 items-center gap-3 px-3 py-3 shadow-sm">
                  <FiMail className="text-cyan-700 dark:text-cyan-300" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => {
                      setForm({ ...form, email: event.target.value });
                      setError('');
                      setAuthMessage('');
                    }}
                    className="w-full rounded-md border-0 bg-transparent text-slate-950 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-300"
                    placeholder="you@company.com"
                    required
                  />
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Password
                <span className="tf-form-field flex min-h-11 items-center gap-3 px-3 py-3 shadow-sm">
                  <FiLock className="text-cyan-700 dark:text-cyan-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => {
                      const password = event.target.value;
                      setForm({ ...form, password });
                      setError('');
                      setAuthMessage('');
                      if (password && password.length < 8) {
                        setWarning('Password looks weak. Use at least 8 characters for a stronger password.');
                      } else {
                        setWarning('');
                      }
                    }}
                    className="w-full rounded-md border-0 bg-transparent text-slate-950 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-300"
                    placeholder="Your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="rounded p-1 text-slate-500 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </span>
                  {warning && <p className="text-sm text-amber-600 dark:text-amber-300">{warning}</p>}
                </label>

                <KineticButton
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 via-blue-600 to-blue-700 shadow-blue-500/30 hover:shadow-[0_24px_50px_-24px_rgba(59,130,246,0.5)]"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </KineticButton>
              </form>

              <div className="mt-6 flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                <GhostButton as={Link} to="/signup" className="px-3 py-2 text-sm shadow-none">Employee signup</GhostButton>
                <Link to="/company-onboarding" className="font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100">Register a company</Link>
              </div>
            </div>
          </section>
        </div>
      </AuroraScene>
  );
}
