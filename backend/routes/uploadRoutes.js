// routes/uploadRoutes.js
const express = require("express");
const multer = require("multer");
const router = express.Router();

const parser = require("../upload"); // existing Cloudinary upload config (kept for compatibility)
const fetch = require("node-fetch");
const pdf = require("pdf-parse");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");
const getCollection = require("../config/Chroma"); // async function returning Chroma collection

// -------------- Health --------------
router.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), service: "uploadRoutes" });
});

// -------------- Existing single upload (kept, optional) --------------
router.post("/", parser.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });
    res.json({
      url: req.file.path,
      public_id: req.file.filename,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    console.error("Upload route error:", error);
    res.status(500).json({ msg: "Server error during file upload", error: error.message });
  }
});

// ========== Helpers: ticket fetch via authTickets, download, extract, chunk, embed ==========
// In uploadRoutes.js - update fetchTicketById function
async function fetchTicketById(ticketId, authHeader, baseUrl) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tickets/${ticketId}`;
  const r = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    credentials: "include",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Ticket fetch failed (${r.status}): ${text}`);
  }
  const response = await r.json();
  
  // Handle wrapped response format { ticket: {...} }
  return response.ticket || response;
}

async function indexTicketAttachments({ ticket, project, size, overlap }) {
  // Ensure we have the actual ticket object
  const ticketData = ticket.ticket || ticket;
  
  console.log('Processing ticket:', ticketData._id);
  console.log('Attachments found:', ticketData.attachments?.length || 0);
  
  const attachments = Array.isArray(ticketData.attachments) ? ticketData.attachments : [];
  const chunks = [];

  for (let i = 0; i < attachments.length; i++) {
    const attachment = attachments[i];
    console.log(`Processing attachment ${i + 1}:`, { 
      filename: attachment.filename, 
      url: attachment.url?.substring(0, 50) + '...' 
    });

    const url = attachment.url;
    const filename = attachment.filename;
    
    if (!url) {
      console.log(`Skipping attachment ${i + 1}: no URL`);
      continue;
    }

    try {
      const text = await extractTextFromUrl(url, filename);
      if (text && text.trim()) {
        const parts = chunkText(text, { size, overlap });
        parts.forEach((p, idx) => {
          chunks.push({
            id: `${ticketData._id}:${i}:${idx}:${Buffer.from(url).toString("base64").slice(0, 8)}`,
            text: p,
            metadata: {
              project: project || "tickets",
              ticketId: String(ticketData._id),
              attachmentIndex: i,
              url,
              filename: filename || null,
              createdAt: ticketData.createdAt || null,
              updatedAt: ticketData.updatedAt || null,
            },
          });
        });
        console.log(`Extracted ${parts.length} chunks from attachment: ${filename}`);
      } else {
        console.log(`No text extracted from attachment: ${filename}`);
      }
    } catch (error) {
      console.error(`Failed to process attachment ${filename}:`, error.message);
    }
  }

  if (chunks.length === 0) {
    return { added: 0, ids: [] };
  }

  console.log(`Embedding ${chunks.length} chunks...`);
  const vectors = await getEmbeddings().embedDocuments(chunks.map(c => c.text));
  
  console.log('Storing in Chroma...');
  const collection = await getCollection();
  await collection.add({
    ids: chunks.map(c => c.id),
    documents: chunks.map(c => c.text),
    metadatas: chunks.map(c => c.metadata),
    embeddings: vectors,
  });

  return { added: chunks.length, ids: chunks.map(c => c.id) };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function deleteTicketFromChroma(ticketId) {
  const collection = await getCollection();
  // If your Chroma supports where filtering on delete:
  // await collection.delete({ where: { ticketId: String(ticketId) } });
  // If not, fetch ids by metadata query first or store a deterministic prefix in id:
  // As ids include the ticketId prefix above, we can filter by that:
  const all = await collection.get(); // caution for large sets; replace with pagination on production
  const idsToDelete = (all?.ids || []).filter(id => id.startsWith(String(ticketId)));
  if (idsToDelete.length > 0) {
    await collection.delete({ ids: idsToDelete });
  }
  return idsToDelete.length;
}

// -------------- Read attachments directly from ticket --------------
// GET /api/upload/tickets/:ticketId/attachments
// Reads the ticket from authTickets, returns its attachments array verbatim.
router.get("/tickets/:ticketId/attachments", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const baseUrl = process.env.INTERNAL_API_BASE || "http://localhost:5000";
    const authHeader = req.headers.authorization;

    const response = await fetchTicketById(ticketId, authHeader, baseUrl);
    console.log('Raw ticket response:', JSON.stringify(response, null, 2));
    
    const ticket = response.ticket || response;
    const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
    
    console.log('Processed attachments:', attachments);
    res.json({ ticketId, count: attachments.length, attachments });
  } catch (e) {
    console.error("Fetch ticket attachments failed:", e);
    res.status(500).json({ error: "Failed to fetch ticket", details: e.message });
  }
});

// -------------- Index a ticket’s attachments (RAG) --------------
// POST /api/upload/tickets/:ticketId/rag/index
// body: { project?: string, size?: number, overlap?: number }
// Reads the ticket via authTickets, downloads each attachment URL, extracts text, chunks, embeds, stores in Chroma
router.post("/tickets/:ticketId/rag/index", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { project = "tickets", size = 800, overlap = 150 } = req.body || {};
    const baseUrl = process.env.INTERNAL_API_BASE || "http://localhost:5000";
    const authHeader = req.headers.authorization;

    const ticket = await fetchTicketById(ticketId, authHeader, baseUrl);
    const result = await indexTicketAttachments({ ticket, project, size, overlap });

    res.json({
      message: "Ticket attachments indexed",
      ticketId,
      chunksIndexed: result.added,
      ids: result.ids,
    });
  } catch (e) {
    console.error("Ticket RAG indexing failed:", e);
    res.status(500).json({ error: "Indexing failed", details: e.message });
  }
});

// -------------- Reindex (delete then index) --------------
// POST /api/upload/tickets/:ticketId/rag/reindex
router.post("/tickets/:ticketId/rag/reindex", async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { project = "tickets", size = 800, overlap = 150 } = req.body || {};
    const baseUrl = process.env.INTERNAL_API_BASE || "http://localhost:5000";
    const authHeader = req.headers.authorization;

    const deleted = await deleteTicketFromChroma(String(ticketId));
    const ticket = await fetchTicketById(ticketId, authHeader, baseUrl);
    const result = await indexTicketAttachments({ ticket, project, size, overlap });

    res.json({
      message: "Ticket attachments reindexed",
      ticketId,
      deletedVectors: deleted,
      chunksIndexed: result.added,
      ids: result.ids,
    });
  } catch (e) {
    console.error("Ticket RAG reindex failed:", e);
    res.status(500).json({ error: "Reindex failed", details: e.message });
  }
});

// -------------------- Helpers reused across RAG --------------------
function normalizeTicketsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tickets)) return payload.tickets;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
}

async function fetchAssignedTickets(authHeader, baseUrl) {
  const url = `${(baseUrl || 'http://localhost:5000').replace(/\/$/, '')}/api/tickets?scope=me`;
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(authHeader ? { Authorization: authHeader } : {}) },
    credentials: 'include',
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Assigned tickets fetch failed (${r.status}): ${t}`);
  }
  const body = await r.json();
  return normalizeTicketsPayload(body);
}

async function downloadBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function extractFromPdf(url) {
  const buf = await downloadBuffer(url);
  const data = await pdf(buf);
  return data.text || '';
}

async function extractFromTextLike(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${url}`);
  return await r.text();
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

async function extractTextFromUrl(url, filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return extractFromPdf(url);
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.json') ||
      lower.endsWith('.csv') || lower.endsWith('.log') || lower.endsWith('.xml') ||
      lower.endsWith('.html') || lower.endsWith('.htm')) {
    const txt = await extractFromTextLike(url);
    return (lower.endsWith('.html') || lower.endsWith('.htm')) ? stripHtml(txt) : txt;
  }
  try { return await extractFromTextLike(url); } catch { return ''; }
}

function chunkText(text, { size = 800, overlap = 150 } = {}) {
  const chunks = [];
  let i = 0;
  const step = Math.max(1, size - overlap);
  while (i < text.length) {
    const end = Math.min(i + size, text.length);
    chunks.push(text.slice(i, end));
    i += step;
  }
  return chunks;
}

let EMB;
function getEmbeddings() {
  if (!EMB) EMB = new HuggingFaceTransformersEmbeddings({ model: 'Xenova/all-MiniLM-L6-v2' });
  return EMB;
}

async function ensureUserIndex({ tickets, userId, project, size, overlap, reindex }) {
  const collection = await getCollection();

  // optional: clear prior user vectors
  if (reindex) {
    try {
      const existing = await collection.get();
      const idsToDelete = (existing?.ids || []).filter(id => id.includes(`:u:${userId}:`));
      if (idsToDelete.length) await collection.delete({ ids: idsToDelete });
    } catch (e) {
      console.warn('Reindex delete warning:', e?.message || e);
    }
  }

  const seen = new Set();
  const chunks = [];
  for (const ticket of tickets) {
    const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
    for (let ai = 0; ai < attachments.length; ai++) {
      const a = attachments[ai];
      const url = typeof a === 'string' ? a : a?.url;
      const filename = typeof a === 'string' ? undefined : a?.filename;
      if (!url || seen.has(url)) continue;
      seen.add(url);

      const text = await extractTextFromUrl(url, filename);
      if (!text || !text.trim()) continue;

      const parts = chunkText(text, { size, overlap });
      parts.forEach((p, pi) => {
        chunks.push({
          id: `${String(ticket._id || ticket.id)}:a${ai}:p${pi}:u:${userId}`,
          text: p,
          metadata: {
            project: project || 'tickets',
            userId: String(userId),
            ticketId: String(ticket._id || ticket.id),
            attachmentIndex: ai,
            url,
            filename: filename || null,
            createdAt: ticket.createdAt || null,
            updatedAt: ticket.updatedAt || null,
          },
        });
      });
    }
  }

  if (!chunks.length) return { added: 0 };

  const vectors = await getEmbeddings().embedDocuments(chunks.map(c => c.text));
  await collection.add({
    ids: chunks.map(c => c.id),
    documents: chunks.map(c => c.text),
    metadatas: chunks.map(c => c.metadata),
    embeddings: vectors,
  });
  return { added: chunks.length };
}

// ---- final combined index + query endpoint (fixes queryEmbeddings shape) ----
router.post('/tickets/me/rag/query', async (req, res) => {
  try {
    const {
      query,
      topK = 5,
      project = 'tickets',
      size = 800,
      overlap = 150,
      reindex = false,
      ensureIndex = true,
      answer = false,
    } = req.body || {};
    answer = false

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    const userId = String(req.user?.id || 'anon');
    const authHeader = req.headers.authorization;
    const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';

    // 1) fetch tickets assigned to the caller (authTickets)
    const tickets = await fetchAssignedTickets(authHeader, baseUrl);

    // 2) build/refresh per-user index if requested
    if (ensureIndex) {
      await ensureUserIndex({ tickets, userId, project, size, overlap, reindex });
    }

    // 3) retrieval: embed query and query Chroma with user filter
    const qvec = await getEmbeddings().embedQuery(query);
    const collection = await getCollection();
    const out = await collection.query({
      queryEmbeddings: [qvec],   // <-- critical fix: wrap in outer array
      nResults: Number(topK) || 5,
      where: { userId },         // metadata filter
    });

    const docs = out?.documents?.[0] || [];
    const metas = out?.metadatas?.[0] || [];
    const scores = out?.distances?.[0] || out?.scores?.[0] || [];

    const results = docs.map((d, i) => ({
      text: d,
      metadata: metas[i] || {},
      score: scores[i],
    }));

    // 4) optional grounded answer
    let synthesized = null;
    if (answer && docs.length) {
      const model = new ChatGoogleGenerativeAI({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        apiKey: process.env.GOOGLE_API_KEY,
        temperature: 0.2,
      });
      const context = results
        .map((r, i) => `Source ${i + 1}: ${r.metadata?.url || r.metadata?.filename || 'unknown'}\n${r.text}`)
        .join('\n\n---\n\n');
      const sys = { role: 'system', content: 'Answer strictly using the provided context; if unsure, say there is not enough information.' };
      const usr = { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}\nAnswer concisely with brief source mentions.` };
      const resp = await model.invoke([sys, usr]);
      synthesized = typeof resp?.content === 'string'
        ? resp.content
        : Array.isArray(resp?.content)
        ? (resp.content[0]?.text || null)
        : null;
    }

    return res.json({
      query,
      topK: Number(topK) || 5,
      ticketsCount: tickets.length,
      results,
      answer: synthesized,
    });
  } catch (e) {
    console.error('RAG query for my tickets failed:', e);
    return res.status(500).json({ error: 'Query failed', details: e.message });
  }
});

// -------------- Errors --------------
router.use((error, req, res, next) => {
  console.error("Upload middleware error:", error);
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ msg: "File too large. Maximum size is 10MB." });
    }
    return res.status(400).json({ msg: `Upload error: ${error.message}` });
  }
  if (error.message && error.message.includes("format not allowed")) {
    return res.status(400).json({
      msg: "File format not supported. Please upload images, PDFs, or common document types.",
    });
  }
  return res.status(500).json({ msg: "Upload failed", error: error.message });
});

module.exports = router;
