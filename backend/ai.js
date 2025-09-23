// chatbot.js
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");


// Simple in-memory store: { userId: [ {role, content, ts}, ... ] }
const conversations = {};
const getHistory = (userId) => conversations[userId] || [];
const appendHistory = (userId, role, content) => {
  const item = { role, content, ts: new Date().toISOString() };
  if (!conversations[userId]) conversations[userId] = [];
  conversations[userId].push(item);
  // optional: trim to last N turns
  if (conversations[userId].length > 200) {
    conversations[userId] = conversations[userId].slice(-200);
  }
};


function setupChatbotRoutes(app) {
  // Init Gemini LLM
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0.3,
    apiKey: process.env.GOOGLE_API_KEY,
  });

  // POST /chat route
  app.post("/api/chat", async (req, res) => {
    const { user_id, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ error: "user_id and message required" });
    }

    try {
      // Pull history
      const history = getHistory(user_id);

      // Convert history to plain text for prompt
      const historyText = history
        .map((h) => `${h.role}: ${h.content}`)
        .join("\n");

      const prompt = `
You are a helpful chatbot. Continue the conversation naturally.
Conversation so far:
${historyText}

User: ${message}
Assistant:
      `;

      // Call Gemini
      const response = await llm.invoke(prompt);
      const reply = response.content || "";

      // Save conversation
      appendHistory(user_id, "user", message);
      appendHistory(user_id, "assistant", reply);

      return res.json({
        reply,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Chat error:", err);
      return res.status(500).json({ error: "Chatbot failed" });
    }
  });
}

module.exports = {setupChatbotRoutes}

module.exports = { setupChatbotRoutes };