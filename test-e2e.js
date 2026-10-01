const testFlow = async () => {
  try {
    console.log('1. Testing /health...');
    const health = await fetch('http://localhost:5000/health').then((r) => r.json());
    console.log('Health Response:', health);

    console.log('\n2. Testing /api/auth/send-otp...');
    const otpRes = await fetch('http://localhost:5000/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: '+919876543210' }),
    }).then((r) => r.json());
    console.log('Send OTP Response:', otpRes);

    const code = otpRes.devCode;
    console.log('\n3. Testing /api/auth/verify-otp with code:', code);
    const verifyRes = await fetch('http://localhost:5000/api/auth/verify-otp', {
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
    const profileRes = await fetch('http://localhost:5000/api/auth/complete-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Alex Vance' }),
    }).then((r) => r.json());
    console.log('Profile Complete Response:', profileRes);

    console.log('\n5. Testing /api/auth/me...');
    const meRes = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    console.log('Get Me Response:', meRes);

    console.log('\n6. Testing /api/friends...');
    const friendsRes = await fetch('http://localhost:5000/api/friends', {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    console.log('Friends Response:', friendsRes);

    console.log('\n7. Testing Frontend on port 5173...');
    const frontRes = await fetch('http://localhost:5173/');
    console.log('Frontend Status:', frontRes.status, frontRes.statusText);

    console.log('\nAll tests completed successfully!');
  } catch (err) {
    console.error('Test error:', err);
  }
};

testFlow();
