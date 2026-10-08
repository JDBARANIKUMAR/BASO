// Base URL is configurable so this works against localhost AND a deployed backend:
//   node test-e2e.js
//   BASE_URL=https://your-backend.onrender.com node test-e2e.js
const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

const testFlow = async () => {
  try {
    console.log(`1. Testing ${BASE_URL}/api/health...`);
    const health = await fetch(`${BASE_URL}/api/health`).then((r) => r.json());
    console.log('Health Response:', health);

    console.log('\n2. Testing /api/auth/send-otp...');
    const otpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '+919876543210' }),
    }).then((r) => r.json());
    console.log('Send OTP Response:', otpRes);

    const code = otpRes.devCode;
    console.log('\n3. Testing /api/auth/verify-otp with code:', code);
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '+919876543210', code }),
    }).then((r) => r.json());
    console.log('Verify Response:', {
      success: verifyRes.success,
      isNewUser: verifyRes.isNewUser,
      user: verifyRes.user,
    });

    const token = verifyRes.accessToken;
    console.log('\n4. Testing /api/auth/complete-profile...');
    const profileRes = await fetch(`${BASE_URL}/api/auth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Alex Vance' }),
    }).then((r) => r.json());
    console.log('Profile Complete Response:', profileRes);

    console.log('\n5. Testing /api/auth/me...');
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    console.log('Get Me Response:', meRes);

    console.log('\n6. Testing /api/friends...');
    const friendsRes = await fetch(`${BASE_URL}/api/friends`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    console.log('Friends Response:', friendsRes);

    console.log('\n7. Testing Frontend on port 5173...');
    const frontRes = await fetch(process.env.CLIENT_URL || 'http://localhost:5173/');
    console.log('Frontend Status:', frontRes.status, frontRes.statusText);

    console.log('\nAll tests completed successfully!');
  } catch (err) {
    console.error('Test error:', err);
  }
};

testFlow();
