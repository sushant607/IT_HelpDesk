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
  const system = new SystemMessage(`
You are an IT helpdesk assistant. Follow these rules strictly:

- Core behavior:
  - Be concise, clear, and professional in all replies. Ask one or two focused questions at a time. Do not create tickets until all required fields are explicitly confirmed. Always prefer clarification over guessing.

- When the user asks for help or hints at an issue:
  1) Determine if the intent is ticket-worthy. If unsure, ask a brief clarifying question first.
  2) Collect and confirm these fields before any ticket creation:
     - Department: one of ['support team A','software team','network team','infrastructure team','hardware team','database team'].
     - Complaint details: a short title (1 line) and a brief description (2–4 lines).
     - Priority: one of ['low','medium','high','urgent']. If unspecified, ask; do not assume.
     - Role-aware assignment:
       -As soon as the department is selected and the role is manager/admin, immediately call fetchAssignees with department=<chosen>. Do this before asking for confirmation. Present the returned users as a numbered list, ask for a pick by number or user id, and store assignedTo. Only then proceed to the final summary and confirmation.
  3) Use a two-step confirmation:
     - Summarize the gathered fields back to the user and ask "Confirm to create the ticket?" with Yes/No options.
     - Only after an explicit Yes, call create_ticket with the confirmed values. If No, ask what to change.

- Constraints:
  - Never invent or infer missing fields. Always ask the user to provide or choose valid enum values. If the department or priority isn’t one of the allowed values, ask the user to pick from the list.
  - Employees: do not request assignedTo. Managers/Admins: require assignedTo and block creation until provided.
  - If the user asks non-ticket questions (e.g., status checks), use the appropriate tool but do not create tickets.
  - If the user says "create a ticket" without giving department and complaint details (and assignedTo for manager/admin), ask for those first and do not call create_ticket yet.

- Tool usage policy:
  - Only call create_ticket after explicit user confirmation and after all required fields are collected and validated. Include assignedTo only when the role is manager/admin.
  - After department is selected and the role is manager/admin, you MUST call fetchAssignees and list its results for selection before confirmation and creation.

- Response style:
  - Use brief prompts to collect info, e.g.:
    - "Which department should handle this? Choose one: support team A, software team, network team, infrastructure team, hardware team, database team."
    - "What’s the issue title (1 line) and a short description (2–4 lines)?"
    - "Priority? Choose one: low, medium, high, urgent."
    - "Available assignees for <Dept>: 1) <Name> (id=<id>) — <count> open 2) <Name> (id=<id>) — <count> open … Pick a number or paste the id."
  - Before the tool call, summarize:
    - "Summary: Dept=<X>, Title=<Y>, Desc=<Z>, Priority=<P>[, AssignedTo=<A>]. Confirm to create the ticket?"

Adhere to this flow on every ticket request. Do not bypass confirmation or required fields.
`);

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
    `You are a helpdesk assistant designed to assist users. You will be asked for help with various technical issues. You must try to resolve trivial issues like login fails, connection issues, etc with helpful troubleshooting.
If the problem is more complex, suggest creating a ticket and help the user create a ticket using the create_ticket tool provided to you with the correct fields. Do not jump straight to creating a ticket, first ensure you gather all the relvant information and then
attempt to create a ticket. Ideally to create a ticket, you must have a description of the problem, the priority, the department to which the ticket should be assigned and some tags. Be helpful in your replies. Only create a ticket when you can't resolve the issue`,
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
    // Tolerate multi-turn flow while gathering fields
    throw new Error('Need more details before creating a ticket');
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
  return `Ticket created successfully.
ID: ${id}
Title: ${args.title}
Priority: ${args.priority}
Department: ${args.department}`;
}

// === TOOL DEFINITIONS ===

// Tool: Connect Gmail (returns authorize URL)
const connectGmailTool = tool(
  async (_input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');
    const r = await fetch('http://localhost:5000/api/gmail/auth/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || ''
      }
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text);
    const { url } = JSON.parse(text);
    return `Open this link to connect Gmail: ${url}`;
  },
  {
    name: 'connectGmail',
    description: 'Generate a one-time Gmail consent URL for the current user.',
    schema: z.object({})
  }
);

// Tool: Fetch gmail mails (fetches recent mails)
const fetchGmailTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');
    const r = await fetch('http://localhost:5000/api/gmail/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || ''
      },
      body: JSON.stringify({
        limit: input?.limit ?? 20,
        windowDays: input?.windowDays ?? 7,
        unreadOnly: input?.unreadOnly ?? true,
        forceBootstrap: input?.forceBootstrap ?? false
      })
    });
    const json = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(json));
    return json;
  },
  {
    name: 'fetchGmail',
    description: 'Fetch recent Gmail messages as structured candidates via server-side integration.',
    schema: z.object({
      limit: z.number().min(1).max(50).optional(),
      windowDays: z.number().min(1).max(30).optional(),
      unreadOnly: z.boolean().optional(),
      forceBootstrap: z.boolean().optional()
    })
  }
);

// Tool: Create tickets for mails with keyword "TICKET" in subject
const createTicketsFromGmailTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');

    // 1. Fetch mails
    const fetchResp = await fetch('http://localhost:5000/api/gmail/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: req.headers.authorization || ''
      },
      body: JSON.stringify({
        limit: input?.limit ?? 20,
        windowDays: input?.windowDays ?? 7,
        unreadOnly: input?.unreadOnly ?? true,
        forceBootstrap: input?.forceBootstrap ?? false
      })
    });
    if (!fetchResp.ok) {
      const errText = await fetchResp.text();
      throw new Error(errText);
    }
    const fetchJson = await fetchResp.json();

    // 2. Filter mails where subject contains "TICKET" (case insensitive)
    const filtered = (fetchJson.candidates || []).filter(c =>
      c.title && c.title.toLowerCase().includes('ticket')
    );

    // 3. Create tickets for each filtered mail
    const created = [];
    for (const mail of filtered) {
      const ticketBody = {
        title: mail.title || 'Email ticket',
        description: mail.description || '',
        priority: input?.priority || 'medium',
        department: input?.department,
        assignedTo: input?.assignedTo
      };
      const ticketResp = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: req.headers.authorization || ''
        },
        body: JSON.stringify(ticketBody)
      });
      const ticketJson = await ticketResp.json();
      if (!ticketResp.ok) {
        throw new Error(JSON.stringify(ticketJson));
      }
      created.push(ticketJson);
    }

    return JSON.stringify({
      total: filtered.length,
      created: created.length,
      tickets: created
    });
  },
  {
    name: 'createTicketsFromGmail',
    description: 'Fetch Gmail mails containing "TICKET" in subject and create tickets.',
    schema: z.object({
      limit: z.number().min(1).max(50).optional(),
      windowDays: z.number().min(1).max(30).optional(),
      unreadOnly: z.boolean().optional(),
      forceBootstrap: z.boolean().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      department: z.enum(['support team A', 'software team', 'network team', 'infrastructure team', 'hardware team', 'database team']).optional(),
      assignedTo: z.string().optional()
    })
  }
);

// Tool: Fetch recommended assignees for a department (manager/admin flow)
const fetchAssigneesTool = tool(
  async (input, config) => {
    const req = config?.configurable?.req;
    if (!req) throw new Error('Request context missing');
    const { department } = input || {};
    if (!department) throw new Error('department is required');

    const url = `http://localhost:5000/api/tickets/recommend-assignees?department=${encodeURIComponent(department)}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: req.headers.authorization || '' }
    });
    const json = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(json));

    const options = (json.recommendations || []).map((u, idx) => ({
      index: idx + 1,
      id: u._id,
      name: u.name,
      email: u.email,
      assignedCount: u.assignedTicketCount
    }));
    return {
      department,
      count: options.length,
      options,
      summary: options.length
        ? options.map(o => `${o.index}) ${o.name} (id=${o.id}) — ${o.assignedCount} open`).join('\n')
        : 'No eligible assignees found for this department'
    };
  },
  {
    name: 'fetchAssignees',
    description: 'Fetch top recommended assignees for a department to pick assignedTo (manager/admin only).only fetch employee under that department and not managers/admins',
    schema: z.object({ department: z.string() })
  }
);

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
      if (input.keywords?.length > 0) query.append('keywords', input.keywords.join('+'));

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
      priority: z.string().optional().describe("Filter by priority: 'low', 'medium', 'high', 'urgent'"),
      keywords: z.array(z.string()).optional().describe("Filter by tickets having certain keywords(max 3)")
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
      if (input.keywords?.length > 0) query.append('keywords', input.keywords.join('+'));

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
      priority: z.string().optional().describe("Filter by priority: 'low', 'medium', 'high', 'urgent'"),
      keywords: z.array(z.string()).optional().describe("Filter by tickets having certain keywords(max 3)")
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

    // Guard for manager/admin: assignedTo must be provided
    if ((req.user.role === 'manager' || req.user.role === 'admin') && !args.assignedTo) {
      throw new Error('assignedTo required for manager/admin before creating ticket');
    }

    // POST to API (server enforces RBAC/department policy)
    const result = await postTicketToAPI(req, args);
    return summarizeTicket(args, result);
  },
{
    name: 'createTicket',
    description:
      'Create a helpdesk ticket. If any arguments are missing, the tool will infer them from the latest user message. Call only when you have all the relevant information and the user requests the creation of a ticket. Create the ticket with the same department as the user',
    schema: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      tags: z.array(z.enum(['VPN', 'Database', 'Installation', 'General', 'Wifi/Ethernet', 'Authentication']))
              .optional().describe("Tags describing the issue of the ticket, max 3"),
      tags: z.array(z.enum(['VPN', 'Database', 'Installation', 'General', 'Wifi/Ethernet', 'Authentication']))
              .optional().describe("Tags describing the issue of the ticket, max 3"),
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
    connectGmail: connectGmailTool,
    fetchGmail: fetchGmailTool,
    createTicketsFromGmail: createTicketsFromGmailTool,
    fetchAssignees: fetchAssigneesTool
  };

  // Initialize LLM with tools
  const llm = new ChatGoogleGenerativeAI({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0.1,
    apiKey: process.env.GoogleGenerativeAI || process.env.GOOGLE_API_KEY,
  }).withConfig({
    tools: [
      fetchMyTicketsTool,
      fetchTeamTicketsTool,
      createTicketTool,
      connectGmailTool,
      fetchGmailTool,
      createTicketsFromGmailTool,
      fetchAssigneesTool
    ]
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
