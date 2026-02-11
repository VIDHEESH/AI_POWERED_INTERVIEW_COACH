const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

(async () => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        console.log("Checking API...");
        const result = await model.generateContent("Test");
        const response = await result.response;
        console.log("API Check: OK -", response.text());

    } catch (e) {
        console.error("API Check Failed:", e);
    }
})();
