require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function reproduce() {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("No API_KEY in .env");
            return;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        // Simulate inputs
        const jd = "Software Engineer. Requires Python, Java, and Distributed Systems knowledge. Strong focus on scalable architecture.";
        const resume = "Experienced Java developer with 5 years in backend systems. Worked on high traffic APIs.";

        const prompt = `You are an experienced technical interviewer. 
             CONTEXT:
             - JD: "${jd && jd.length > 10 ? jd : 'Software Engineering Role (General)'}"
             - Resume: "${resume || 'Not provided'}"
             
             TASK: Create a list of 5 technical interview questions to ask this candidate based SPECIFICALLY on the JD and Resume.
             - If the JD is specific, ask specific questions about those technologies.
             - If the Resume lists specific skills, challenge them on those.
             - If the JD is generic, ask standard but challenging engineering questions.
             
             OUTPUT FORMAT: 
             - Return ONLY a raw JSON array of strings. 
             - DO NOT use markdown code blocks (no \`\`\`json). 
             - DO NOT include any introductory or concluding text.
             
             Example: ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]`;

        console.log("Generating...");

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        console.log("--- Raw Response from Gemini ---");
        console.log(text);
        console.log("-------------------------------");

        // Remove markdown formatting if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            text = jsonMatch[0];
            console.log("Regex Match Success");
            try {
                const parsed = JSON.parse(text);
                console.log("Parsed JSON:", parsed);
            } catch (e) {
                console.error("JSON Parse Error:", e);
            }
        } else {
            console.error("Regex Match FAILED. Fallback would occur here.");
        }

    } catch (err) {
        console.error("Error:", err);
    }
}

reproduce();
