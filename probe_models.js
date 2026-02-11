require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModel(name) {
    console.log(`Testing model: ${name}...`);
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent("Hello via node");
        const response = await result.response;
        console.log(`[SUCCESS] ${name}:`, response.text().substring(0, 20));
    } catch (err) {
        if (err.status === 404 || err.message.includes('404') || err.message.includes('Not Found')) {
            console.log(`[FAILED] ${name}: 404 Not Found`);
        } else if (err.status === 429 || err.message.includes('429')) {
            console.log(`[FAILED] ${name}: 429 Rate Limit (Quota Exceeded)`);
        } else {
            console.log(`[ERROR] ${name}:`, err.message);
        }
    }
}

async function run() {
    const candidates = [
        "gemini-pro",
        "gemini-1.5-pro",
        "gemini-2.0-pro",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest" // Control
    ];

    for (const m of candidates) {
        await testModel(m);
    }
}

run();
