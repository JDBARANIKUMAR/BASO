import bcrypt from 'bcryptjs';
import twilio from 'twilio';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { query } from '../config/db.js';

/**
 * Normalizes and validates phone number.
 * Supports either separate { countryCode: '+91', mobile: '9876543210' }
 * or a full E.164 string like '+919876543210'.
 */
export const sanitizeAndValidateMobile = (rawMobile, rawCountryCode = '+91') => {
  if (!rawMobile || typeof rawMobile !== 'string') {
    const error = new Error('Enter a valid mobile number.');
    error.status = 400;
    throw error;
  }

  let trimmedMobile = rawMobile.trim();
  let trimmedCode = (rawCountryCode || '+91').trim();

  // If mobile already starts with '+', parse it directly
  let fullCandidate = trimmedMobile;
  if (!fullCandidate.startsWith('+')) {
    if (!trimmedCode.startsWith('+')) {
      trimmedCode = `+${trimmedCode}`;
    }
    const cleanDigits = trimmedMobile.replace(/\D/g, '');
    fullCandidate = `${trimmedCode}${cleanDigits}`;
  }

  try {
    const phoneNumber = parsePhoneNumber(fullCandidate);
    if (!phoneNumber || !phoneNumber.isValid()) {
      const error = new Error('Invalid mobile number. Please check country code and digits.');
      error.status = 400;
      throw error;
    }

    const countryCode = `+${phoneNumber.countryCallingCode}`;
    const nationalNumber = phoneNumber.nationalNumber;
    const e164 = phoneNumber.format('E.164');

    return { countryCode, mobile: nationalNumber, e164 };
  } catch (err) {
    const error = new Error(err.message || 'Invalid mobile number format.');
    error.status = 400;
    throw error;
  }
};

/**
 * Send OTP Code:
 * - Deletes expired OTP rows
 * - Enforces 30s cooldown
 * - Hashes 6-digit OTP with bcrypt
 * - Stores in Neon Postgres otp_codes with 5-minute expiry
 * - Dispatches SMS via Twilio (or logs in console in dev)
 */
export const sendOtpCode = async ({ countryCode: rawCountryCode, mobile: rawMobile }) => {
  const { countryCode, mobile, e164 } = sanitizeAndValidateMobile(rawMobile, rawCountryCode);

  // 1. Delete all expired OTP rows across the table
  try {
    await query('DELETE FROM otp_codes WHERE expires_at < NOW();');
  } catch (err) {
    console.warn('[Database] Cleanup of expired OTPs warning:', err.message);
  }

  // 2. Check 30-second resend cooldown for this phone
  const existingOtpResult = await query(
    'SELECT created_at FROM otp_codes WHERE country_code = $1 AND mobile = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1;',
    [countryCode, mobile]
  );

  const now = Date.now();
  if (existingOtpResult.rows.length > 0) {
    const createdAtTime = new Date(existingOtpResult.rows[0].created_at).getTime();
    const elapsedSeconds = Math.floor((now - createdAtTime) / 1000);
    const COOLDOWN_SECONDS = 30;

    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const remainingSeconds = COOLDOWN_SECONDS - elapsedSeconds;
      const error = new Error(`Please wait ${remainingSeconds} seconds before requesting a new OTP.`);
      error.status = 429;
      error.remainingSeconds = remainingSeconds;
      throw error;
    }
  }

  // 3. Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 4. Hash OTP with bcrypt
  const saltRounds = 10;
  const otpHash = await bcrypt.hash(otp, saltRounds);

  // 5. Expiration: 5 minutes from now
  const expiresAt = new Date(now + 5 * 60 * 1000);

  // 6. Delete previous pending codes for this phone & insert new record
  await query('DELETE FROM otp_codes WHERE country_code = $1 AND mobile = $2;', [countryCode, mobile]);
  await query(
    'INSERT INTO otp_codes (country_code, mobile, otp_hash, expires_at, attempts) VALUES ($1, $2, $3, $4, 0);',
    [countryCode, mobile, otpHash, expiresAt]
  );

  // 7. SMS Delivery via Twilio
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const isDev = process.env.NODE_ENV === 'development';

  let smsSent = false;

  if (twilioAccountSid && twilioAuthToken && twilioFrom) {
    try {
      const client = twilio(twilioAccountSid, twilioAuthToken);
      await client.messages.create({
        body: `Your BASO verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        from: twilioFrom,
        to: e164,
      });
      smsSent = true;
      console.log(`[Twilio SMS] Successfully delivered verification OTP to ${e164}`);
    } catch (smsError) {
      console.error(`[Twilio SMS Error] Failed to deliver to ${e164}:`, smsError.message);
      if (!isDev) {
        const error = new Error(`Failed to deliver SMS: ${smsError.message}`);
        error.status = 502;
        throw error;
      }
    }
  } else {
    if (!isDev) {
      console.warn('[Twilio SMS] Twilio credentials are missing in production environment.');
    }
  }

  // 8. Console output in development or when SMS is unconfigured
  if (isDev || !smsSent) {
    console.log(`\n======================================================`);
    console.log(`[DEV OTP] Phone Number: ${e164}`);
    console.log(`[DEV OTP] Code:         ${otp}`);
    console.log(`[DEV OTP] Expires In:   5 minutes`);
    console.log(`======================================================\n`);
  }

  return {
    success: true,
    message: smsSent ? 'OTP sent to your phone via SMS.' : 'Verification code generated.',
    countryCode,
    mobile,
    e164,
    resendAvailableInSeconds: 30,
    devCode: isDev || !smsSent ? otp : undefined,
  };
};

/**
 * Verify OTP Code:
 * - Checks hash, expiry, and max 5 attempts
 * - Deletes the OTP row upon successful verification
 * - Finds or creates user in users table
 */
export const verifyOtpCode = async ({ countryCode: rawCountryCode, mobile: rawMobile, otp: rawOtp }) => {
  if (!rawOtp || typeof rawOtp !== 'string' || rawOtp.trim().length === 0) {
    const error = new Error('Please enter the 6-digit verification code.');
    error.status = 400;
    throw error;
  }

  const { countryCode, mobile, e164 } = sanitizeAndValidateMobile(rawMobile, rawCountryCode);
  const inputOtp = rawOtp.trim();

  // 1. Fetch active OTP record
  const result = await query(
    'SELECT * FROM otp_codes WHERE country_code = $1 AND mobile = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1;',
    [countryCode, mobile]
  );

  if (result.rows.length === 0) {
    const error = new Error('OTP has expired or was not requested. Please request a new code.');
    error.status = 400;
    throw error;
  }

  const record = result.rows[0];

  // 2. Check maximum 5 attempts limit
  if (record.attempts >= 5) {
    await query('DELETE FROM otp_codes WHERE id = $1;', [record.id]);
    const error = new Error('Maximum verification attempts exceeded (5). Please request a new OTP.');
    error.status = 429;
    throw error;
  }

  // 3. Verify bcrypt hash
  const isMatch = await bcrypt.compare(inputOtp, record.otp_hash);

  if (!isMatch) {
    const updatedAttempts = record.attempts + 1;
    await query('UPDATE otp_codes SET attempts = $1 WHERE id = $2;', [updatedAttempts, record.id]);
    const remaining = 5 - updatedAttempts;

    const error = new Error(
      remaining > 0
        ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Maximum attempts reached. Please request a new code.'
    );
    error.status = 400;
    throw error;
  }

  // 4. On successful verification, delete OTP row
  await query('DELETE FROM otp_codes WHERE id = $1;', [record.id]);

  // 5. Look up user or create new user
  const userResult = await query(
    'SELECT * FROM users WHERE (country_code = $1 AND mobile = $2) OR mobile = $3 LIMIT 1;',
    [countryCode, mobile, e164]
  );

  let user = userResult.rows[0];
  let isNewUser = false;

  if (!user) {
    const insertResult = await query(
      `INSERT INTO users (country_code, mobile, name, is_registered, is_online, last_seen)
       VALUES ($1, $2, $3, false, true, NOW())
       RETURNING *;`,
      [countryCode, mobile, '']
    );
    user = insertResult.rows[0];
    isNewUser = true;
  } else {
    // If user existed without country_code, update it
    if (!user.country_code) {
      await query('UPDATE users SET country_code = $1 WHERE id = $2;', [countryCode, user.id]);
      user.country_code = countryCode;
    }
    const isRegistered = user.is_registered ?? user.isRegistered ?? false;
    if (!isRegistered) {
      isNewUser = true;
    }
  }

  return { user, isNewUser, countryCode, mobile, e164 };
};
