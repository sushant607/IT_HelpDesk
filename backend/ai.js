const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { HumanMessage, SystemMessage, AIMessage } = require('@langchain/core/messages');
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const fetch = require('node-fetch');

// In-memory conversation store
const conversations = {};
const getHistory = (userId) => conversations[userId] || [];
const appendHistory = (userId, role, content) => {
  if (!conversations[userId]) conversations[userId] = [];
  conversations[userId].push({ role, content, ts: new Date().toISOString() });
  if (conversations[userId].length > 200) {
    conversations[userId] = conversations[userId].slice(-200);
  }
};

function buildMessages(userId, userText) {
  const system = new SystemMessage(
    "You are a helpful IT helpdesk assistant. Use tools for ticket queries. Be concise and clear."
  );

  const historyTurns = getHistory(userId) || [];

  const history = historyTurns
    .map((turn) => {
      if (!turn || !turn.role || !turn.content) return null;
      if (turn.role === 'user') return new HumanMessage(String(turn.content));
      if (turn.role === 'assistant') return new AIMessage(String(turn.content));
      // Drop any accidental 'system' entries from history to satisfy Gemini
      return null;
    })
    .filter(Boolean);

  const current = new HumanMessage(String(userText || '').trim());

  // Ensure: exactly one system message at index 0
  const messages = [system, ...history, current].filter(Boolean);

  // Final guard: no SystemMessage after index 0
  const hasBadSystem = messages.slice(1).some(
    (m) => typeof m._getType === 'function' && m._getType() === 'system'
  );
  if (hasBadSystem) {
    // remove any stray system messages just in case
    return [system, ...history.filter(
      (m) => !(typeof m._getType === 'function' && m._getType() === 'system')
    ), current].filter(Boolean);
  }
  return messages;
}


// === TOOL DEFINITIONS ===

const fetchMyTicketsTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error("Request context not available");

    try {
      console.log('🔧 Fetching user tickets...');
      const headers = { 'Authorization': req.headers.authorization };
      const query = new URLSearchParams({ scope: 'me' });

      if (input.status) query.append('status', input.status);
      if (input.priority) query.append('priority', input.priority);
      
      const response = await fetch(`http://localhost:5000/api/tickets?${query.toString()}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tickets = data.tickets || [];
      
      if (tickets.length === 0) {
        return "No tickets found for you";
      }
      
      const byStatus = tickets.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      
      const summary = `You have ${tickets.length} ticket(s):\n` +
        Object.entries(byStatus).map(([status, count]) => `- ${count} ${status}`).join('\n');

      console.log('User tickets fetched successfully');
      return summary;
    } catch (error) {
      console.error('Error fetching user tickets:', error.message);
      throw error;
    }
  },
  {
    name: "fetchMyTickets",
    description: "Fetches tickets assigned to or created by the current user",
    schema: z.object({
      status: z.string().optional().describe("Filter by status: 'open', 'in_progress', 'resolved'"),
      priority: z.string().optional().describe("Filter by priority: 'low', 'medium', 'high', 'urgent'")
    }),
  }
);

const fetchTeamTicketsTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error("Request context not available");

    try {
      // Check permissions
      if (req.user.role !== 'manager' && req.user.role !== 'admin') {
        return "Sorry, only managers and admins can view team tickets.";
      }
      
      console.log('🔧 Fetching team tickets...');
      const headers = { 'Authorization': req.headers.authorization };
      const query = new URLSearchParams({ scope: 'team' });
      
      if (input.status) query.append('status', input.status);
      if (input.priority) query.append('priority', input.priority);
      
      const response = await fetch(`http://localhost:5000/api/tickets?${query.toString()}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tickets = data.tickets || [];
      
      if (tickets.length === 0) {
        return "No tickets found for your team.";
      }
      
      const byStatus = tickets.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {});
      
      const summary = `Your team has ${tickets.length} ticket(s):\n` +
        Object.entries(byStatus).map(([status, count]) => `- ${count} ${status}`).join('\n');
      
      console.log('Team tickets fetched successfully');
      return summary;
    } catch (error) {
      console.error('Error fetching team tickets:', error.message);
      throw error;
    }
  },
  {
    name: "fetchTeamTickets",
    description: "Fetches tickets for the user's team/department (managers and admins only)",
    schema: z.object({
      status: z.string().optional().describe("Filter by status: 'open', 'in_progress', 'resolved'"),
      priority: z.string().optional().describe("Filter by priority: 'low', 'medium', 'high', 'urgent'")
    }),
  }
);

// === MAIN CHATBOT SETUP ===

function setupChatbotRoutes(app) {
  console.log('🚀 Initializing AI Chatbot...');

  // Create tools map for easy access
  const toolsMap = {
    fetchMyTickets: fetchMyTicketsTool,
    fetchTeamTickets: fetchTeamTicketsTool
  };

  // Initialize LLM with tools
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0.1,
    apiKey: process.env.GOOGLE_API_KEY,
  }).withConfig({
    tools: [fetchMyTicketsTool, fetchTeamTicketsTool, fetchMyOpenTicketsTool]
  });

  app.post("/api/ai-chat", async (req, res) => {
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: "Message is required as a non-empty string." });
    }
  
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
  
    appendHistory(userId, "user", message.trim());
  
    try {
      const messages = buildMessages(userId, message);

      // just making sure
      const types = messages.map((m) => (typeof m._getType === 'function' ? m._getType() : 'unknown'));
      // If the first isn’t 'system' or any other 'system' appears later, bail fast:
      if (types[0] !== 'system' || types.slice(1).includes('system')) {
        console.error('Invalid message order/types:', types);
        return res.json({
          reply: 'Internal error: prompt ordering issue. Please try again.',
          error: 'System message must be first and only one system message allowed',
          timestamp: new Date().toISOString()
        });
      }
      const response = await llm.invoke(messages, { configurable: { req } });
  
      const toolCalls = response.tool_calls || [];
      if (toolCalls.length > 0) {
        const toolCall = toolCalls[0];
        const tool = toolsMap[toolCall.name];
        if (!tool) {
          const reply = "I tried to use a tool that's not available.";
          appendHistory(userId, "assistant", reply);
          return res.json({ reply, timestamp: new Date().toISOString() });
        }
        try {
          const toolResult = await tool.invoke(toolCall.args || {}, { configurable: { req } });
          const reply = typeof toolResult === 'string'
            ? toolResult
            : (toolResult?.summary || JSON.stringify(toolResult));
          appendHistory(userId, "assistant", reply);
          return res.json({ reply, toolUsed: toolCall.name, timestamp: new Date().toISOString() });
        } catch (e) {
          const reply = `I encountered an error: ${e.message}`;
          appendHistory(userId, "assistant", reply);
          return res.json({ reply, error: e.message, timestamp: new Date().toISOString() });
        }
      }
  
      const reply = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? (response.content[0]?.text || "I'm here to help with your tickets!")
          : "I'm here to help with your tickets!";
      appendHistory(userId, "assistant", reply);
      return res.json({ reply, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("AI Chat Error:", err);
      const reply = "I'm sorry, I'm having trouble processing your request right now. Please try again.";
      return res.json({ reply, error: err.message, timestamp: new Date().toISOString() });
    }
  });
  
  console.log('AI Chatbot setup complete');
}

module.exports = { setupChatbotRoutes };
