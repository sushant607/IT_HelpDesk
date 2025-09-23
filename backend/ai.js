// chatbot.js
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
});

// Define the create_ticket function schema
const functions = [
    {
        name: "create_ticket",
        description:
            "Generate a structured helpdesk ticket JSON object based on the user request or conversation.",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string", enum: ["low", "medium", "high"] },
                tags: { type: "array", items: { type: "string" } },
                assigned_to: { type: "string" },
                due_date: {
                    type: "string",
                    description: "ISO 8601 date (YYYY-MM-DD) or null",
                },
                metadata: { type: "object" },
            },
            required: ["title", "description", "priority", "tags"],
        },
    },
];

module.exports.setupChatbotRoutes = (app) => {
    app.post("/api/chat", async (req, res) => {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required" });

        try {
            // Send user message along with tool definition
            const chat = model.startChat({
                tools: [{ functionDeclarations: functions }],
                history: [],
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;

            // Check if the model decided to call a function
            const functionCalls = response.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                const fnCall = functionCalls[0];
                if (fnCall.name === "create_ticket") {
                    // Extract structured arguments
                    const args = fnCall.args;
                    return res.json({
                        reply:
                            "I’ve created a ticket for your issue. Here are the details:",
                        ticket: args,
                        timestamp: new Date().toISOString(),
                    });
                }
            }

            // Otherwise just return a normal reply
            return res.json({
                reply: response.text(),
                ticket: null,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.error("Chat error:", err);
            res.status(500).json({ error: "Chatbot failed" });
        }
    });
}