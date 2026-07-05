import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiEye, FiEyeOff, FiImage, FiUploadCloud } from 'react-icons/fi';
import { AuroraScene, DevicePreview, GhostButton, KineticButton } from '../components/ReactBitsUI';
import SiteFooter from '../components/SiteFooter';
import SiteNavbar from '../components/SiteNavbar';
import { authAPI } from '../services/api';

export default function CompanyOnboarding() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    address: '',
    phone: '',
    logo_url: '',
    description: '',
    start_time: '',
    end_time: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordWarning, setPasswordWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const update = (event) => {
    const { name, value } = event.target;
    if (name === 'phone') {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      setForm({ ...form, phone: digits });
      return;
    }
    if (name === 'password') {
      setPasswordWarning(value && value.length < 8 ? 'Use at least 8 characters for a stronger password.' : '');
    }
    setForm({ ...form, [name]: value });
  };

  const handleLogoFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingLogo(true);

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for the company logo.');
      setUploadingLogo(false);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file must be 2MB or smaller.');
      setUploadingLogo(false);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);

    try {
      const response = await authAPI.uploadCompanyLogo(file);
      setForm((current) => ({ ...current, logo_url: response.data.logo_url }));
    } catch (err) {
      setLogoPreview('');
      setError(err.response?.data?.detail || 'Unable to upload company logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!/^\d{10}$/.test(form.phone)) {
      setError('Phone number must be exactly 10 digits and valid.');
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters and strong.');
      setLoading(false);
      return;
    }

    if (!form.start_time || !form.end_time) {
      setError('Company starting time and ending time are required.');
      setLoading(false);
      return;
    }

    if (form.end_time <= form.start_time) {
      setError('Company ending time must be greater than starting time.');
      setLoading(false);
      return;
    }

    const companyEmail = form.email.trim().toLowerCase();
    if (companyEmail === 'superadmin@gmail.com') {
      setError('This email is reserved for platform Super Admin. Use a different company email.');
      setLoading(false);
      return;
    }

    try {
      await authAPI.companyRegister(form);
      setSuccess('Company registered successfully. Redirecting to login...');
      window.setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            email: companyEmail,
            message: 'Company registered successfully. Login with your company email and password to open the Founder Admin dashboard.',
          },
        });
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Company registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-mesh-page min-h-screen text-slate-950 dark:text-white">
        <SiteNavbar />
        <AuroraScene className="min-h-screen px-4 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mt-6 grid overflow-hidden rounded-lg border border-white/70 bg-white/75 shadow-hyper backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.08] lg:grid-cols-[0.9fr_1.1fr]">
              <div className="hidden p-6 lg:block">
                <DevicePreview compact />
                <div className="mt-5 rounded-lg border border-teal-100 bg-white/85 p-5 dark:border-white/10 dark:bg-white/[0.06]">
                  <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-100">Workspace setup</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">Your first account becomes Founder Admin.</h2>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-5 border-l border-slate-200 bg-white/95 p-6 text-slate-950 shadow-[inset_1px_0_0_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 dark:text-white md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-100">
                  <FiArrowLeft /> Home
                </Link>
              </div>
              <p className="inline-flex items-center gap-2 text-sm font-bold uppercase text-cyan-700 dark:text-cyan-300"><FiBriefcase /> Company onboarding</p>
              <h1 className="mt-3 text-3xl font-black">Create your company workspace</h1>
              <p className="mt-2 text-slate-600 dark:text-slate-300">Your company details are saved in the database, and this login becomes the Founder Admin account.</p>
            </div>
            {[
              ['name', 'Company name', 'Acme Operations'],
              ['email', 'Company email', 'admin@acme.com'],
              ['address', 'Company address', 'Business Park, Bengaluru'],
              ['phone', 'Phone number', '9876543210'],
              ['start_time', 'Company starting time', '09:00'],
              ['end_time', 'Company ending time', '18:00'],
              ['password', 'Password', 'Create a secure password'],
            ].map(([name, label, placeholder]) => {
              if (name === 'password') {
                return (
                  <label key={name} className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {label}
                    <span className="tf-form-field flex min-h-11 items-center gap-3 px-3 py-3 shadow-sm">
                      <input
                        name={name}
                        type={showPassword ? 'text' : 'password'}
                        value={form[name]}
                        onChange={update}
                        placeholder={placeholder}
                        required
                        autoComplete="new-password"
                        className="w-full rounded-md border-0 bg-transparent text-slate-950 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-300"
                      />
                      {form.password && (
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="rounded p-1 text-slate-500 transition hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-200"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <FiEyeOff /> : <FiEye />}
                        </button>
                      )}
                    </span>
                    {passwordWarning && <p className="text-sm text-amber-600 dark:text-amber-300">{passwordWarning}</p>}
                  </label>
                );
              }

              return (
                <label key={name} className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {label}
                  <input
                    name={name}
                    type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : name.includes('time') ? 'time' : 'text'}
                    inputMode={name === 'phone' ? 'numeric' : undefined}
                    pattern={name === 'phone' ? '\\d{10}' : undefined}
                    maxLength={name === 'phone' ? 10 : undefined}
                    value={form[name]}
                    onChange={update}
                    placeholder={placeholder}
                    required={name !== 'logo_url'}
                    className="tf-form-field px-3 py-3 text-slate-950 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-300 dark:[color-scheme:dark]"
                  />
                </label>
              );
            })}
            <div className="grid gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">
              Company logo
              <div className="grid gap-4 rounded-lg border border-dashed border-cyan-300/70 bg-cyan-50/80 p-4 dark:border-cyan-300/40 dark:bg-cyan-300/10 md:grid-cols-[120px_1fr]">
                <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-white text-cyan-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-cyan-200">
                  {logoPreview || form.logo_url ? (
                    <img src={logoPreview || form.logo_url} alt="Company logo preview" className="h-full w-full object-contain p-2" />
                  ) : (
                    <FiImage className="text-3xl" />
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-hyper transition hover:bg-cyan-300">
                    <FiUploadCloud />
                    {uploadingLogo ? 'Uploading logo...' : 'Choose logo file'}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoFile} className="sr-only" disabled={uploadingLogo} />
                  </label>
                  <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Upload a PNG, JPG, WEBP, or SVG logo up to 2MB. This logo will appear on company, employee, and Super Admin views.
                  </p>
                  {form.logo_url && <p className="break-all text-xs font-semibold text-emerald-700 dark:text-emerald-300">Logo saved and ready.</p>}
                </div>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 md:col-span-2">
              Company description
              <textarea
                name="description"
                value={form.description}
                onChange={update}
                rows={4}
                placeholder="What your company does, office policies, or onboarding notes"
                className="tf-form-field px-3 py-3 text-slate-950 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-300"
              />
            </label>
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-300/30 dark:bg-red-400/10 dark:text-red-200 md:col-span-2">{error}</div>}
            {success && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-200 md:col-span-2">{success}</div>}
            <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row">
              <KineticButton type="submit" disabled={loading}>
                {loading ? 'Creating workspace...' : 'Register company'}
              </KineticButton>
              <GhostButton as={Link} to="/login">Already registered</GhostButton>
            </div>
              </form>
            </div>
          </div>
        </AuroraScene>
        <SiteFooter />
    </div>
  );
}
