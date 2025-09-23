// chatbot.js
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    systemInstruction: "You are a helpdesk assistant designed to help people with technical issues. You should try to resolve trivial issues yourself before using the function provided to create a new ticket.",
});

// In-memory conversation store: { userId: [ { role, parts } ] }
const conversations = {};

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
                department: {
                    type: "string",
                    enum: [
                        'support team A',
                        'software team',
                        'network team',
                        'infrastructure team',
                        'hardware team',
                        'database team'
                    ],
                    description: "Which team the issue should be assigned to",
                }
            },
            required: ["title", "description", "priority", "department"],
        },
    },
];

module.exports.setupChatbotRoutes = (app) => {
    app.post("/api/chat", async (req, res) => {
        const { user_id, message } = req.body;
        if (!user_id || !message) {
            return res.status(400).json({ error: "user_id and message are required" });
        }

        // Initialize history for new users
        if (!conversations[user_id]) {
            conversations[user_id] = [];
        }

        try {
            // Add user message to history
            conversations[user_id].push({ role: "user", parts: [{ text: message }] });

            // Start chat with user-specific history
            const chat = model.startChat({
                tools: [{ functionDeclarations: functions }],
                history: conversations[user_id],
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;

            // Check if the model decided to call a function
            const functionCalls = response.functionCalls();
            if (functionCalls && functionCalls.length > 0) {
                const fnCall = functionCalls[0];
                if (fnCall.name === "create_ticket") {
                    const ticket = fnCall.args;

                    // Save ticket JSON as assistant response in history
                    conversations[user_id].push({
                        role: "model",
                        parts: [{ text: JSON.stringify(ticket) }],
                    });

                    return res.json({
                        reply: "I’ve created a ticket for your issue. Here are the details:",
                        ticket,
                        timestamp: new Date().toISOString(),
                    });
                }
            }

            // Otherwise just return a normal reply
            const reply = response.text();

            // Save assistant reply in history
            conversations[user_id].push({ role: "model", parts: [{ text: reply }] });

            return res.json({
                reply,
                ticket: null,
                timestamp: new Date().toISOString(),
            });
        } catch (err) {
            console.error("Chat error:", err);
            res.status(500).json({ error: "Chatbot failed" });
        }
    });
};
