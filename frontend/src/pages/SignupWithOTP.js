import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEye, FiEyeOff, FiLock, FiMail, FiShield, FiUserCheck } from 'react-icons/fi';
import { AuroraScene, GhostButton, KineticButton } from '../components/ReactBitsUI';
import { authAPI } from '../services/api';

export default function SignupWithOTP() {
  const navigate = useNavigate();
  const [timer, setTimer] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordWarning, setPasswordWarning] = useState('');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    otp: '',
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (!timer) return undefined;
    const id = setTimeout(() => setTimer((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const update = (event) => {
    const { name, value } = event.target;
    if (name === 'password') {
      setPasswordWarning(value && value.length < 8 ? 'Use at least 8 characters for a stronger password.' : '');
    }
    const nextValue = name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value;
    setForm({ ...form, [name]: nextValue });
    setError('');
  };

  const sendOTP = async () => {
    if (otpSent && timer > 0) {
      setError('Use the latest OTP already sent to your email, or wait for the timer to finish before requesting a new one.');
      return;
    }
    setError('');
    setSuccess('');
    setLoadingAction('send');
    try {
      const email = form.email.trim().toLowerCase();
      const { data } = await authAPI.sendOTP({
        email,
        first_name: form.first_name,
        last_name: form.last_name,
      });
      setOtpSent(true);
      setTimer(300);
      if (data.delivery === 'email') {
        setSuccess(
          `Verification email sent to ${form.email}. Open Gmail (inbox or spam) and enter the 6-digit code from the email.`
        );
      } else {
        setSuccess(
          `OTP created for ${form.email}. SMTP is off, so check the backend terminal for the 6-digit code.`
        );
      }
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the backend API. Run start-app.bat from the Company Project folder, then try Send OTP again.');
      } else if (err.response.status === 500) {
        setError(
          err.response.data?.detail
            || 'OTP email failed. Configure EmailJS (free Gmail in browser): run backend/scripts/setup-emailjs.ps1'
        );
      } else {
        setError(signupMessage(err.response?.data?.detail) || 'Unable to send OTP. Check the email address and try again.');
      }
    } finally {
      setLoadingAction('');
    }
  };

  const signupMessage = (message) => {
    if (!message) return '';
    if (/already registered|already has a login account|email already registered|email already exists/i.test(message)) {
      return 'This employee account is already registered.';
    }
    if (/not added|company has not added|company id does not match/i.test(message)) {
      return 'Your email is not added by your company admin.';
    }
    return message;
  };

  const verifyOTPAndCreateAccount = async () => {
    setError('');
    setSuccess('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters for a stronger account.');
      return;
    }

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoadingAction('verify');
    const email = form.email.trim().toLowerCase();
    const otp = form.otp.replace(/\D/g, '').trim();

    if (otp.length !== 6) {
      setError('Enter the full 6-digit OTP from your email (include a leading 0 if shown).');
      setLoadingAction('');
      return;
    }

    const apiDetail = (err) => {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail.map((item) => item.msg || item.message || JSON.stringify(item)).join(' ');
      }
      return '';
    };

    try {
      await authAPI.verifyOTP(email, otp);
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the backend API. Make sure the backend is running, then try again.');
      } else {
        setError(apiDetail(err) || 'Invalid or expired OTP. Send a new OTP and try again.');
      }
      setLoadingAction('');
      return;
    }

    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email,
        password: form.password,
        confirm_password: form.confirm_password,
      };
      await authAPI.register(payload);
      navigate('/login', {
        state: {
          message: 'Account created successfully. Please login.',
          email,
        },
      });
    } catch (err) {
      if (!err.response) {
        setError('OTP was verified but account creation failed. Check that the backend is running and try again.');
      } else {
        setError(
          signupMessage(apiDetail(err))
            || 'Account could not be created. If your company already added you as an employee, use the same email or contact your admin.'
        );
      }
    } finally {
      setLoadingAction('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setError('Please click Send OTP, enter the received OTP, and verify it to create your account.');
  };

  return (
    <AuroraScene className="min-h-screen px-4 py-10">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl rounded-lg border border-white/12 bg-white/95 p-6 text-slate-950 shadow-hyper backdrop-blur-xl dark:bg-slate-950/85 dark:text-white sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-900 dark:text-cyan-300">
            <FiArrowLeft /> Home
          </Link>
          <span className="text-xl font-black">TaskFlow</span>
        </div>
        <p className="mt-6 inline-flex items-center gap-2 rounded-md bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-100"><FiUserCheck /> OTP employee access</p>
        <h1 className="mt-4 text-3xl font-black text-slate-950 dark:text-white">Employee signup</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Verify your email with OTP before creating your login password.</p>

        <div className="mt-8 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input name="first_name" value={form.first_name} onChange={update} placeholder="First name" className="tf-form-field px-3 py-3 outline-none" required />
            <input name="last_name" value={form.last_name} onChange={update} placeholder="Last name" className="tf-form-field px-3 py-3 outline-none" required />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="tf-form-field flex items-center gap-3 px-3 py-3">
              <FiMail className="text-slate-400" />
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={update}
                placeholder="employee@gmail.com"
                className="w-full bg-transparent text-slate-950 outline-none dark:text-white"
                required
              />
            </label>
            <KineticButton
              type="button"
              onClick={sendOTP}
              disabled={loadingAction === 'send' || (otpSent && timer > 0) || !form.email || !form.first_name || !form.last_name}
            >
              <FiMail />
              {loadingAction === 'send' ? 'Sending...' : otpSent && timer > 0 ? `Resend in ${timer}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
            </KineticButton>
          </div>

          {otpSent && (
            <div className="grid gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-300/20 dark:bg-cyan-300/10">
              <label className="grid gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                Enter sent OTP
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    name="otp"
                    value={form.otp}
                    onChange={update}
                    maxLength={6}
                    placeholder="6 digit OTP"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="tf-form-field px-3 py-3 text-center text-lg font-bold tracking-[0.25em] outline-none"
                  />
                  <KineticButton
                    type="button"
                    onClick={verifyOTPAndCreateAccount}
                    disabled={loadingAction === 'verify' || form.otp.length !== 6 || !form.password || !form.confirm_password}
                  >
                    <FiShield />
                    {loadingAction === 'verify' ? 'Checking...' : 'Verify OTP'}
                  </KineticButton>
                </div>
              </label>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                OTP expires in {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}.
              </p>
            </div>
          )}

          <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
            <label className="tf-form-field flex items-center gap-3 px-3 py-3">
              <FiLock className="text-slate-400" />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={update}
                placeholder="Password"
                className="w-full bg-transparent text-slate-950 outline-none dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="rounded p-1 text-slate-500 transition hover:text-cyan-600 dark:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </label>
            {passwordWarning && <p className="text-sm text-amber-600 dark:text-amber-300">{passwordWarning}</p>}
            <label className="tf-form-field flex items-center gap-3 px-3 py-3">
              <FiLock className="text-slate-400" />
              <input
                name="confirm_password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={update}
                placeholder="Confirm password"
                className="w-full bg-transparent text-slate-950 outline-none dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="rounded p-1 text-slate-500 transition hover:text-cyan-600 dark:text-slate-300"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </label>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">
            Use the same email your company admin added for your employee profile.
          </p>

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {success && (
            <div
              role="status"
              className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              <p className="flex items-start gap-2">
                <FiMail className="mt-0.5 shrink-0 text-lg" aria-hidden />
                <span>{success}</span>
              </p>
            </div>
          )}

          <GhostButton type="submit" disabled={loadingAction === 'verify'}>
            Create employee account
          </GhostButton>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
          Already have an account? <Link to="/login" className="font-bold text-cyan-600">Login</Link>
        </p>
      </form>
    </AuroraScene>
  );
}
