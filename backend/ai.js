const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

const VALID_DEPARTMENTS = [
  'support team A',
  'software team',
  'network team',
  'infrastructure team',
  'hardware team',
  'database team',
];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Robust fetch across Node versions
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  try { fetchFn = require('node-fetch'); }
  catch { console.error('Please install node-fetch'); process.exit(1); }
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const structuredModel = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  systemInstruction:
    'You are a helpdesk assistant. If a new ticket is needed, call create_ticket with the correct fields.',
});

const createTicketFunctionDeclarations = [
  {
    name: 'create_ticket',
    description: 'Create a helpdesk ticket from user text.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: VALID_PRIORITIES },
        department: {
          type: 'string',
          enum: VALID_DEPARTMENTS,
          description: 'Which team should handle this issue',
        },
      },
      required: ['title', 'description', 'priority', 'department'],
    },
  },
];

// Structured parse helper (returns { title, description, priority, department })
async function parseCreateTicketArgs(req, userText) {
  const userId = req.user?.id || 'anon';
  // Minimal ephemeral history; this parser is stateless for robustness
  const chat = structuredModel.startChat({
    tools: [{ functionDeclarations: createTicketFunctionDeclarations }],
    history: [{ role: 'user', parts: [{ text: String(userText || '') }] }],
  });

  const result = await chat.sendMessage(userText);
  const response = await result.response;
  const functionCalls = response.functionCalls?.() || [];

  if (!functionCalls.length || functionCalls[0].name !== 'create_ticket') {
    throw new Error('Parser did not produce create_ticket arguments');
  }
  const args = functionCalls[0].args || {};

  // Basic normalization
  if (!args.title || !args.description || !args.priority || !args.department) {
    throw new Error('Incomplete ticket fields after parsing');
  }
  if (!VALID_PRIORITIES.includes(args.priority)) {
    throw new Error(`Invalid priority: ${args.priority}`);
  }
  if (!VALID_DEPARTMENTS.includes(args.department)) {
    throw new Error(`Invalid department: ${args.department}`);
  }
  return args;
}

// Helper to POST to your API
async function postTicketToAPI(req, payload) {
  const resp = await fetchFn('http://localhost:5000/api/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: req.headers.authorization || '',
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Ticket API error: ${resp.status} ${resp.statusText} ${text}`.trim());
  }
  return resp.json().catch(() => ({}));
}

function summarizeTicket(args, apiResult) {
  const id = apiResult?.ticket_id || '(pending id)';
  return `Ticket created successfully.\nID: ${id}\nTitle: ${args.title}\nPriority: ${args.priority}\nDepartment: ${args.department}`;
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

// New LangChain tool (keeps existing tools unchanged)
const createTicketTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    const rawUserMessage = config?.configurable?.rawUserMessage || '';
    if (!req) throw new Error('Request context not available');

    // If args are incomplete, parse them from the user message via Structured API
    let args = { ...input };
    const needParse =
      !args.title || !args.description || !args.priority || !args.department;

    if (needParse) {
      if (!rawUserMessage) throw new Error('Missing user message for parsing');
      args = await parseCreateTicketArgs(req, rawUserMessage);
    }

    // POST to API (server enforces RBAC/department policy)
    const result = await postTicketToAPI(req, args);
    return summarizeTicket(args, result);
  },
  {
    name: 'createTicket',
    description:
      'Create a helpdesk ticket. If any arguments are missing, the tool will infer them from the latest user message.',
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      department: z.enum([
        'support team A',
        'software team',
        'network team',
        'infrastructure team',
        'hardware team',
        'database team',
      ]).optional(),
    }),
  }
);

// === MAIN CHATBOT SETUP ===

function setupChatbotRoutes(app) {
  console.log('🚀 Initializing AI Chatbot...');

  // Create tools map for easy access
  const toolsMap = {
    fetchMyTickets: fetchMyTicketsTool,
    fetchTeamTickets: fetchTeamTicketsTool,
    createTicket: createTicketTool,
  };

  // Initialize LLM with tools
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0.1,
    apiKey: process.env.GOOGLE_API_KEY,
  }).withConfig({
    tools: [fetchMyTicketsTool, fetchTeamTicketsTool, fetchMyOpenTicketsTool, createTicketTool]
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
        const toolName = toolCall.name;
        const toolArgs = toolCall.args || {};
      
        if (toolsMap[toolName]) {
          try {
            const toolResult = await toolsMap[toolName].invoke(toolArgs, {
              configurable: { req, rawUserMessage: message },
            });
      
            const reply = typeof toolResult === 'string'
              ? toolResult
              : (toolResult?.summary || JSON.stringify(toolResult));
      
            appendHistory(userId, 'assistant', reply);
            return res.json({ reply, toolUsed: toolName, timestamp: new Date().toISOString() });
          } catch (toolError) {
            const errorReply = `I encountered an error: ${toolError.message}`;
            appendHistory(userId, 'assistant', errorReply);
            return res.json({ reply: errorReply, error: toolError.message, timestamp: new Date().toISOString() });
          }
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
