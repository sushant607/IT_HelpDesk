// routes/uploadRoutes.js — complete RAG implementation
const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const pdf = require('pdf-parse');
const { HuggingFaceTransformersEmbeddings } = require('@langchain/community/embeddings/huggingface_transformers');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const getCollection = require('../config/Chroma');
const parser = require("../upload");

// Existing upload route (keep as-is)
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
    console.error('Upload route error:', error);
    res.status(500).json({ msg: "Server error during file upload", error: error.message });
  }
});

// ---------- RAG helpers ----------
function normalizeTicketsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.tickets)) return payload.tickets;
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
    throw new Error(`Tickets fetch failed (${r.status}): ${t}`);
  }
  return normalizeTicketsPayload(await r.json());
}

async function downloadBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function extractFromPdf(url) {
  const buf = await downloadBuffer(url);
  const data = await pdf(buf);
  return data.text || '';
}

async function extractFromTextLike(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
  return await r.text();
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function extractTextFromUrl(url, filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) return extractFromPdf(url);
  if (lower.endsWith('.txt') || lower.endsWith('.html') || lower.endsWith('.md')) {
    const txt = await extractFromTextLike(url);
    return lower.endsWith('.html') ? stripHtml(txt) : txt;
  }
  try { return await extractFromTextLike(url); } catch { return ''; }
}

function chunkText(text, { size = 800, overlap = 150 } = {}) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, Math.min(i + size, text.length)));
    i += Math.max(1, size - overlap);
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
  
  if (reindex) {
    try {
      const existing = await collection.get();
      const idsToDelete = (existing?.ids || []).filter(id => id.includes(`:u:${userId}:`));
      if (idsToDelete.length) await collection.delete({ ids: idsToDelete });
    } catch (e) {
      console.warn('Reindex delete warning:', e?.message);
    }
  }

  const chunks = [];
  const seen = new Set();
  
  for (const ticket of tickets) {
    const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];
    for (let ai = 0; ai < attachments.length; ai++) {
      const a = attachments[ai];
      console.log(a);
      const url = typeof a === 'string' ? a : a?.url;
      const filename = typeof a === 'string' ? undefined : a?.filename;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      try {
        const text = await extractTextFromUrl(url, filename);
        // console.log(text);
        if (!text?.trim()) continue;

        const parts = chunkText(text, { size, overlap });
        parts.forEach((p, pi) => {
          chunks.push({
            id: `${String(ticket._id || ticket.id)}:a${ai}:p${pi}:u:${userId}`,
            text: p,
            metadata: {
              project: project || 'tickets',
              userId: String(userId),
              ticketId: String(ticket._id || ticket.id),
              url, filename: filename || null,
            },
          });
        });
      } catch (e) {
        console.warn(`Failed to extract from ${filename}:`, e.message);
      }
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

// ---------- MAIN RAG ENDPOINT ----------
router.post('/tickets/me/rag/query', async (req, res) => {
  try {
    const { query, topK = 5, project = 'tickets', size = 800, overlap = 150, reindex = false, ensureIndex = true } = req.body || {};

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    const userId = String(req.user?.id || 'anon');
    const authHeader = req.headers.authorization;
    const baseUrl = process.env.INTERNAL_API_BASE || 'http://localhost:5000';

    console.log('RAG Query:', { query, userId, ensureIndex });

    // 1) Fetch assigned tickets
    const tickets = await fetchAssignedTickets(authHeader, baseUrl);
    console.log('Tickets found:', tickets.length);

    // 2) Ensure index if requested
    if (ensureIndex) {
      const indexResult = await ensureUserIndex({ tickets, userId, project, size, overlap, reindex });
      console.log('Index result:', indexResult);
    }

    // 3) Query vector store
    const qvec = await getEmbeddings().embedQuery(query);
    const collection = await getCollection();
    const results = await collection.query({
      queryEmbeddings: [qvec], // Must be array format
      nResults: Number(topK) || 5,
      where: { userId },
    });

    const docs = results?.documents?.[0] || [];
    const metas = results?.metadatas?.[0] || [];
    
    if (!docs.length) {
      return res.json({
        query, topK, ticketsCount: tickets.length,
        answer: 'No relevant information found in assigned ticket attachments.',
        sources: [],
      });
    }

    // 4) Generate answer
    const model = new ChatGoogleGenerativeAI({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0.2,
    });

    const context = docs.slice(0, 5)
      .map((d, i) => `Source ${i + 1}: ${metas[i]?.url || metas[i]?.filename || 'source'}\n${String(d).slice(0, 600)}`)
      .join('\n\n---\n\n');

    const sys = { role: 'system', content: 'Answer using only the provided context. If unsure, say you do not have enough information.' };
    const usr = { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}\nAnswer concisely with source references [1], [2], etc.` };
    
    const resp = await model.invoke([sys, usr]);
    const answer = typeof resp?.content === 'string' ? resp.content : (resp?.content?.[0]?.text || '');

    const sources = docs.slice(0, 5).map((_, i) => ({
      index: i + 1,
      url: metas[i]?.url || null,
      filename: metas[i]?.filename || null,
      ticketId: metas[i]?.ticketId || null,
    }));

    return res.json({ query, topK, ticketsCount: tickets.length, answer, sources });
  } catch (e) {
    console.error('RAG query failed:', e);
    return res.status(500).json({ error: 'Query failed', details: e.message });
  }
});

module.exports = router;
