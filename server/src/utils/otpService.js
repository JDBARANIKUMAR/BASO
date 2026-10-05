import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { prisma } from '../config/db.js';

// Validate and format mobile number to international E.164 format
export const sanitizeAndValidateMobile = (mobile, defaultCountry = 'IN') => {
  if (!mobile || typeof mobile !== 'string') {
    const error = new Error('Enter a valid mobile number.');
    error.status = 400;
    throw error;
  }

  const trimmed = mobile.trim();
  try {
    const phoneNumber = parsePhoneNumber(trimmed, defaultCountry);
    if (!phoneNumber || !phoneNumber.isValid()) {
      const error = new Error('Enter a valid mobile number.');
      error.status = 400;
      throw error;
    }
    // Format to strict international E.164 (e.g. +919876543210)
    return phoneNumber.format('E.164');
  } catch (err) {
    const error = new Error('Enter a valid mobile number.');
    error.status = 400;
    throw error;
  }
};

export const sendOtpCode = async (mobile) => {
  const sanitized = sanitizeAndValidateMobile(mobile);
  const now = new Date();

  // Check if an OTP was sent recently (30 seconds cooldown)
  const existingOtp = await prisma.otp.findUnique({ where: { mobile: sanitized } });
  if (existingOtp && existingOtp.resendAvailableAt > now) {
    const remainingSeconds = Math.ceil((existingOtp.resendAvailableAt.getTime() - now.getTime()) / 1000);
    const error = new Error(`Please wait ${remainingSeconds} seconds before requesting a new OTP.`);
    error.status = 429;
    error.remainingSeconds = remainingSeconds;
    throw error;
  }

  // Generate 6-digit random numeric code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
  const resendAvailableAt = new Date(Date.now() + 30 * 1000); // 30 seconds cooldown

  await prisma.otp.upsert({
    where: { mobile: sanitized },
    update: {
      code,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
    },
    create: {
      mobile: sanitized,
      code,
      expiresAt,
      resendAvailableAt,
      attempts: 0,
    },
  });

  console.log(`[OTP SERVICE] Code for ${sanitized}: ${code} (expires in 5m)`);

  // Optional Twilio SMS Integration
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (twilioAccountSid && twilioAuthToken && twilioFrom) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(twilioAccountSid, twilioAuthToken);
      await client.messages.create({
        body: `Your BASO verification code is: ${code}. Valid for 5 minutes.`,
        from: twilioFrom,
        to: sanitized,
      });
      console.log(`[OTP SERVICE] Twilio SMS successfully sent to ${sanitized}`);
    } catch (err) {
      console.error(`[OTP SERVICE] Twilio SMS dispatch error:`, err.message);
    }
  }

  return {
    success: true,
    mobile: sanitized,
    resendAvailableInSeconds: 30,
    devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
  };
};

export const verifyOtpCode = async (mobile, inputCode) => {
  const sanitized = sanitizeAndValidateMobile(mobile);
  const now = new Date();

  const record = await prisma.otp.findUnique({ where: { mobile: sanitized } });
  if (!record) {
    const err = new Error('No OTP requested or code has expired.');
    err.status = 400;
    throw err;
  }

  if (record.expiresAt < now) {
    await prisma.otp.delete({ where: { id: record.id } });
    const err = new Error('OTP has expired. Please request a new one.');
    err.status = 400;
    throw err;
  }

  if (record.attempts >= 5) {
    await prisma.otp.delete({ where: { id: record.id } });
    const err = new Error('Too many invalid attempts. Please request a new OTP.');
    err.status = 429;
    throw err;
  }

  if (record.code !== inputCode.trim()) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 },
    });
    const err = new Error('Incorrect verification code. Please try again.');
    err.status = 400;
    throw err;
  }

  // Verification successful: consume the OTP
  await prisma.otp.delete({ where: { id: record.id } });
  return true;
};
