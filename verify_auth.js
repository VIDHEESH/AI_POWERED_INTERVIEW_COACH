// const fetch = require('node-fetch'); // Native fetch in Node 18+

// If node < 18, we might need to install node-fetch. For now assume native fetch or environment supports it.
// If this fails, I'll update package.json to include node-fetch or use http module.
// Actually, let's use the http module to be safe and dependency-free for the test script, or just assume fetch is available in Node 18.
// I'll stick to native fetch(). If it fails, I'll switch.

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'password123'
};

async function runTests() {
    console.log('--- Starting Verification ---');

    // 1. Register
    console.log(`\n1. Registering user: ${TEST_USER.email}`);
    let res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_USER)
    });
    let data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', data);

    if (res.status !== 201) {
        console.error('Registration failed. Aborting.');
        return;
    }

    // 2. Login
    console.log('\n2. Logging in...');
    res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_USER.email, password: TEST_USER.password })
    });
    data = await res.json();
    console.log('Status:', res.status);
    console.log('Body:', data); // Should contain token

    if (res.status !== 200 || !data.token) {
        console.error('Login failed. Aborting.');
        return;
    }
    const token = data.token;

    // 3. Get Profile
    console.log('\n3. Getting Profile...');
    res = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    data = await res.json();
    console.log('Status:', res.status);
    console.log('Body:', data);

    if (res.status !== 200 || data.email !== TEST_USER.email) {
        console.error('Get Profile failed.');
    }

    // 4. Update Profile
    console.log('\n4. Updating Profile...');
    const NEW_NAME = 'Updated Name';
    res = await fetch(`${BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: NEW_NAME })
    });
    data = await res.json();
    console.log('Status:', res.status);
    console.log('Body:', data);

    if (res.status !== 200 || data.user.name !== NEW_NAME) {
        console.error('Update Profile failed.');
    } else {
        console.log('\n--- Verification SUCCESS ---');
    }
}

// Check if fetch is available (Node 18+)
if (!globalThis.fetch) {
    console.error("This environment doesn't support native fetch. Please use Node 18+ or install node-fetch.");
} else {
    runTests().catch(err => console.error(err));
}
