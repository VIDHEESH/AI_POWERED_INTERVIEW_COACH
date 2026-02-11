require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        // There isn't a direct "listModels" on the main class in some versions,
        // but we can try a basic generate to see if we get a specific error or use the model endpoint if supported.
        // Actually, newer SDKs might not expose listModels directly easily without looking at docs.
        // Let's try to just hit the REST API directly with fetch to list models.

        const key = process.env.API_KEY;
        if (!key) {
            console.error("No API KEY found in .env");
            return;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("Error listing models:", data);
        }

    } catch (err) {
        console.error("List Models failed:", err);
    }
}

listModels();
