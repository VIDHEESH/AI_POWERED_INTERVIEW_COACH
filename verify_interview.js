// verify_interview.js
// Uses native fetch (Node 18+)
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
// We need a token. We can register/login a new user to get one.

async function runTests() {
    console.log('--- Starting Interview Verification ---');

    // 1. Login/Register to get Token
    const userEmail = `rec${Date.now()}@test.com`;
    console.log(`\n1. Registering user: ${userEmail}`);
    let res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Recorder', email: userEmail, password: 'password123' })
    });

    if (res.status !== 201) {
        console.error('Registration failed');
        return;
    }

    res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password: 'password123' })
    });
    const authData = await res.json();
    const token = authData.token;
    console.log('Got Token:', token ? 'Yes' : 'No');

    // 2. Fetch Questions
    console.log('\n2. Fetching Questions...');
    res = await fetch(`${BASE_URL}/interview/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const questions = await res.json();
    console.log(`Got ${questions.length} questions`);
    if (questions.length === 0) {
        console.error('No questions found!');
        return;
    }
    const questionId = questions[0].id;

    // 3. Upload Video
    // We need to simulate a file upload.
    // We'll create a dummy text file as a "video" for this test since creating a real binary video blob is complex in pure node script without deps.
    // The server just checks if file exists, it doesn't validate ffmpeg integrity yet.
    fs.writeFileSync('dummy.webm', 'fake video content');

    console.log('\n3. Uploading Video...');
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync('dummy.webm')], { type: 'video/webm' });
    formData.append('video', fileBlob, 'test_video.webm');
    formData.append('questionId', questionId.toString());

    res = await fetch(`${BASE_URL}/interview/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    const uploadData = await res.json();
    console.log('Upload Status:', res.status);
    console.log('Upload Response:', uploadData);

    if (res.ok) {
        console.log('Video saved at:', uploadData.session.video_url);
    } else {
        console.error('Upload Failed');
    }

    // 4. Get Sessions
    console.log('\n4. Fetching Sessions...');
    res = await fetch(`${BASE_URL}/interview/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const sessions = await res.json();
    console.log(`Found ${sessions.length} sessions`);
    const mySession = sessions.find(s => s.question_text === questions[0].text);

    if (mySession) {
        console.log('SUCCESS: Found our uploaded session!');
    } else {
        console.error('FAILED: Recorded session not found in history');
    }

    // Cleanup
    fs.unlinkSync('dummy.webm');
    console.log('\n--- Verification Finished ---');
}

runTests().catch(err => console.error(err));
