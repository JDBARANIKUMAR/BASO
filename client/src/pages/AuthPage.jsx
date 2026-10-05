import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RotateCw, AlertCircle, ChevronDown, Search, X } from 'lucide-react';
import { parsePhoneNumber, isValidPhoneNumber, getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

// ─── Country flag emoji from ISO 3166 code ──────────────────────────────────
const countryFlag = (cc) => {
  if (!cc || cc.length !== 2) return '🌐';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
};

// ─── Country data (name + ISO code + dial code) ─────────────────────────────
const COUNTRY_NAMES = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AS: 'American Samoa', AD: 'Andorra',
  AO: 'Angola', AI: 'Anguilla', AG: 'Antigua and Barbuda', AR: 'Argentina', AM: 'Armenia',
  AW: 'Aruba', AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BS: 'Bahamas',
  BH: 'Bahrain', BD: 'Bangladesh', BB: 'Barbados', BY: 'Belarus', BE: 'Belgium',
  BZ: 'Belize', BJ: 'Benin', BM: 'Bermuda', BT: 'Bhutan', BO: 'Bolivia',
  BA: 'Bosnia and Herzegovina', BW: 'Botswana', BR: 'Brazil', BN: 'Brunei', BG: 'Bulgaria',
  BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia', CM: 'Cameroon', CA: 'Canada',
  CV: 'Cape Verde', KY: 'Cayman Islands', CF: 'Central African Republic', TD: 'Chad',
  CL: 'Chile', CN: 'China', CO: 'Colombia', KM: 'Comoros', CG: 'Congo',
  CD: 'Congo (DRC)', CK: 'Cook Islands', CR: 'Costa Rica', CI: "Côte d'Ivoire",
  HR: 'Croatia', CU: 'Cuba', CY: 'Cyprus', CZ: 'Czech Republic', DK: 'Denmark',
  DJ: 'Djibouti', DM: 'Dominica', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt',
  SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', EE: 'Estonia', SZ: 'Eswatini',
  ET: 'Ethiopia', FJ: 'Fiji', FI: 'Finland', FR: 'France', GA: 'Gabon',
  GM: 'Gambia', GE: 'Georgia', DE: 'Germany', GH: 'Ghana', GR: 'Greece',
  GD: 'Grenada', GT: 'Guatemala', GN: 'Guinea', GW: 'Guinea-Bissau', GY: 'Guyana',
  HT: 'Haiti', HN: 'Honduras', HK: 'Hong Kong', HU: 'Hungary', IS: 'Iceland',
  IN: 'India', ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland',
  IL: 'Israel', IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan',
  KZ: 'Kazakhstan', KE: 'Kenya', KI: 'Kiribati', KP: 'North Korea', KR: 'South Korea',
  KW: 'Kuwait', KG: 'Kyrgyzstan', LA: 'Laos', LV: 'Latvia', LB: 'Lebanon',
  LS: 'Lesotho', LR: 'Liberia', LY: 'Libya', LI: 'Liechtenstein', LT: 'Lithuania',
  LU: 'Luxembourg', MO: 'Macao', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia',
  MV: 'Maldives', ML: 'Mali', MT: 'Malta', MH: 'Marshall Islands', MR: 'Mauritania',
  MU: 'Mauritius', MX: 'Mexico', FM: 'Micronesia', MD: 'Moldova', MC: 'Monaco',
  MN: 'Mongolia', ME: 'Montenegro', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar',
  NA: 'Namibia', NR: 'Nauru', NP: 'Nepal', NL: 'Netherlands', NZ: 'New Zealand',
  NI: 'Nicaragua', NE: 'Niger', NG: 'Nigeria', MK: 'North Macedonia', NO: 'Norway',
  OM: 'Oman', PK: 'Pakistan', PW: 'Palau', PS: 'Palestine', PA: 'Panama',
  PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru', PH: 'Philippines', PL: 'Poland',
  PT: 'Portugal', QA: 'Qatar', RO: 'Romania', RU: 'Russia', RW: 'Rwanda',
  KN: 'Saint Kitts and Nevis', LC: 'Saint Lucia', VC: 'Saint Vincent', WS: 'Samoa',
  SA: 'Saudi Arabia', SN: 'Senegal', RS: 'Serbia', SC: 'Seychelles', SL: 'Sierra Leone',
  SG: 'Singapore', SK: 'Slovakia', SI: 'Slovenia', SB: 'Solomon Islands', SO: 'Somalia',
  ZA: 'South Africa', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka', SD: 'Sudan',
  SR: 'Suriname', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan',
  TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo',
  TO: 'Tonga', TT: 'Trinidad and Tobago', TN: 'Tunisia', TR: 'Turkey', TM: 'Turkmenistan',
  TV: 'Tuvalu', UG: 'Uganda', UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VU: 'Vanuatu', VE: 'Venezuela',
  VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
};

const buildCountryList = () => {
  const codes = getCountries();
  return codes
    .filter((c) => COUNTRY_NAMES[c])
    .map((c) => ({
      code: c,
      name: COUNTRY_NAMES[c] || c,
      dialCode: '+' + getCountryCallingCode(c),
      flag: countryFlag(c),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// ─── Country Code Dropdown ──────────────────────────────────────────────────
const CountryCodePicker = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const countries = useMemo(buildCountryList, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [search, countries]);

  const current = countries.find((c) => c.code === selected);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch('');
        }}
        className="flex items-center gap-1.5 px-3 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm hover:border-zinc-600 transition-colors shrink-0 focus:outline-none focus:border-white"
      >
        <span className="text-lg leading-none">{current?.flag || '🌐'}</span>
        <span className="font-medium">{current?.dialCode || '+91'}</span>
        <ChevronDown
          size={14}
          className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 max-h-72 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-2.5 border-b border-zinc-800 flex items-center gap-2">
            <Search size={14} className="text-zinc-500 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-white text-sm placeholder-zinc-600 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-zinc-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Countries List */}
          <div className="overflow-y-auto no-scrollbar flex-1">
            {filtered.length === 0 ? (
              <div className="text-center text-zinc-500 text-xs py-6">No countries found</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.code);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-zinc-900 transition-colors ${
                    c.code === selected ? 'bg-zinc-900 text-white' : 'text-zinc-300'
                  }`}
                >
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-zinc-500 text-xs font-mono">{c.dialCode}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── AuthPage Component ─────────────────────────────────────────────────────
export const AuthPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Step: 'mobile' | 'otp'
  const [step, setStep] = useState('mobile');
  const [countryCode, setCountryCode] = useState('IN'); // Default India
  const [nationalNumber, setNationalNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // The full E.164 number we'll send to the backend
  const fullE164 = useMemo(() => {
    if (!nationalNumber.trim()) return '';
    const dialCode = '+' + getCountryCallingCode(countryCode);
    const cleaned = nationalNumber.replace(/\D/g, '');
    return dialCode + cleaned;
  }, [nationalNumber, countryCode]);

  // Inline validation error for the number
  const validationError = useMemo(() => {
    const digits = nationalNumber.replace(/\D/g, '');
    if (!digits) return ''; // empty = no error yet
    if (digits.length < 4) return ''; // still typing
    // Use libphonenumber-js to validate
    if (!isValidPhoneNumber(fullE164)) {
      return 'Enter a valid mobile number';
    }
    return '';
  }, [nationalNumber, fullE164]);

  // Timer countdown for OTP resend
  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Request OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!nationalNumber.trim()) {
      setError('Please enter your mobile number.');
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { mobile: fullE164 });
      setStep('otp');
      setResendTimer(res.resendAvailableInSeconds || 30);
      if (res.devCode) {
        setDevCode(res.devCode);
        setOtp(res.devCode); // Pre-fill for dev testing
      }
    } catch (err) {
      console.error('[AuthPage] Send OTP error:', err);
      setError(
        err.isNetworkError
          ? 'Server unreachable. Please check if the backend is running.'
          : err.status === 400
          ? 'Invalid number. Please check the mobile number and try again.'
          : err.message || 'OTP failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!otp || otp.trim().length < 4) {
      setError('Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        mobile: fullE164,
        code: otp.trim(),
      });

      login(res.accessToken, res.user);

      if (res.isNewUser) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('[AuthPage] Verify OTP error:', err);
      setError(
        err.isNetworkError
          ? 'Server unreachable. Please check if the backend is running.'
          : err.status === 400
          ? 'OTP failed. Invalid or expired verification code.'
          : err.message || 'OTP failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Allow only digits in the national number input
  const handleNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '');
    setNationalNumber(raw);
    if (error) setError(''); // Clear error on typing
  };

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Top Header */}
      <div className="flex justify-center pt-6">
        <Logo size="md" />
      </div>

      {/* Center Auth Card */}
      <div className="w-full max-w-sm mx-auto my-auto py-8">
        {step === 'mobile' ? (
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              Sign in with mobile
            </h1>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Enter your mobile number to receive a one-time verification code.
            </p>

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Mobile Number
                </label>

                {/* Country Code + Number Input */}
                <div className="flex gap-2">
                  <CountryCodePicker
                    selected={countryCode}
                    onChange={(code) => {
                      setCountryCode(code);
                      if (error) setError('');
                    }}
                  />

                  <input
                    type="tel"
                    autoFocus
                    inputMode="numeric"
                    placeholder="9876543210"
                    value={nationalNumber}
                    onChange={handleNumberChange}
                    disabled={loading}
                    className="flex-1 min-w-0 px-4 py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors text-base font-mono tracking-wider"
                  />
                </div>

                {/* Inline validation error */}
                {validationError && nationalNumber.replace(/\D/g, '').length >= 4 && (
                  <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-white shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              {/* API error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">
                  <AlertCircle size={15} className="shrink-0 text-white" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || Boolean(validationError && nationalNumber.length >= 4)}
                className="w-full py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Enter code</h1>
              <button
                onClick={() => {
                  setStep('mobile');
                  setError('');
                  setOtp('');
                  setDevCode('');
                }}
                className="text-xs text-zinc-400 hover:text-white underline underline-offset-4"
              >
                Change number
              </button>
            </div>

            <p className="text-zinc-400 text-sm mb-6">
              Sent to <span className="text-white font-medium font-mono">{fullE164}</span>
            </p>

            {devCode && (
              <div className="mb-4 p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">
                <span className="font-semibold text-white">Dev Code:</span>{' '}
                <span className="font-mono text-white tracking-widest text-sm">{devCode}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <input
                  type="text"
                  autoFocus
                  maxLength={6}
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  className="w-full text-center tracking-[0.4em] font-mono text-2xl py-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300">
                  <AlertCircle size={15} className="shrink-0 text-white" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <RotateCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                {resendTimer > 0 ? (
                  <p className="text-xs text-zinc-500 font-medium">
                    Resend code in <span className="text-zinc-300">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-xs text-white font-medium hover:underline underline-offset-4"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Footer */}
      <div className="text-center pb-4 text-xs text-zinc-600">
        Strictly private. End-to-end real-time communication.
      </div>
    </div>
  );
};

export default AuthPage;
