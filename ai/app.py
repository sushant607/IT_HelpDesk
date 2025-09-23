# app.py
"""
Helpdesk Bot with LangChain + Gemini
- Agent (LangChain + Gemini)
- Redis-backed user conversation history
- Tool: create_ticket (internally calls LLM to parse user query into JSON ticket)
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

import redis.asyncio as redis_async

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.prompts import SystemMessagePromptTemplate
from langchain_core.tools import tool
from langchain.schema import SystemMessage

# --- Env / Config ---
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Redis setup
redis = redis_async.from_url(REDIS_URL, decode_responses=True)
def _conv_key(user_id: str) -> str:
    return f"chat:history:{user_id}"

async def _get_history(user_id: str) -> List[Dict[str, str]]:
    items = await redis.lrange(_conv_key(user_id), 0, -1)
    return [json.loads(i) for i in items]

async def _append_history(user_id: str, role: str, content: str):
    item = {"role": role, "content": content, "ts": datetime.utcnow().isoformat()}
    await redis.rpush(_conv_key(user_id), json.dumps(item))
    await redis.ltrim(_conv_key(user_id), -200, -1)

# --- Ticket model ---
class Ticket(BaseModel):
    title: str
    description: str
    priority: str
    tags: List[str]
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    metadata: Dict[str, Any] = {}

# --- Core LLM ---
llm = ChatGoogleGenerativeAI(
    model=GEMINI_MODEL,
    temperature=0.2,
    api_key=GOOGLE_API_KEY,
)

# --- Tool: create_ticket ---
@tool("create_ticket", return_direct=True)
def create_ticket(query: str) -> dict:
    """
    Parse a user query into a structured helpdesk ticket.
    Uses Gemini to produce a JSON ticket object.
    """
    prompt = f"""
Convert the following user request into a JSON helpdesk ticket with these fields:
- title: short summary
- description: detailed description
- priority: low, medium, or high
- tags: list of strings
- assigned_to: string or null
- due_date: ISO-8601 date string or null
- metadata: free-form dict

Return ONLY valid JSON, nothing else.

User query:
\"\"\"{query}\"\"\"
"""
    try:
        response = llm.with_.invoke(prompt)
        raw = getattr(response, "content", str(response))
        start, end = raw.find("{"), raw.rfind("}")
        obj = json.loads(raw[start:end+1]) if start != -1 and end != -1 else json.loads(raw)
        print(response)
        return Ticket(**obj).dict()
    except Exception as e:
        return {"error": f"Failed to create ticket: {e}", "raw_output": raw[:500]}

# --- Agent ---
tools = [create_ticket]
system_prompt = SystemMessage(
    content=(
        "You are a helpful helpdesk assistant. "
        "Respond conversationally to user queries. "
        "If the user describes an issue, bug, or request, "
        "call the create_ticket tool to structure it."
    )
)

prompt = ChatPromptTemplate.from_messages(
    [
        SystemMessagePromptTemplate.from_template(system_prompt.content),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ]
)

agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# --- FastAPI app ---
app = FastAPI(title="Helpdesk Bot with Ticket Tool")

class ChatRequest(BaseModel):
    user_id: str
    message: str

class ChatResponse(BaseModel):
    reply: str
    ticket: Optional[Dict[str, Any]] = None
    timestamp: str

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    history = await _get_history(req.user_id)
    await _append_history(req.user_id, "user", req.message)

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: agent_executor.invoke({"input": req.message, "chat_history": history}),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    reply = result.get("output", "")
    ticket = None
    # agent tool calls are recorded in "intermediate_steps"
    for step in result.get("intermediate_steps", []):
        if step[0].tool == "create_ticket":
            ticket = step[1]

    await _append_history(req.user_id, "assistant", reply)
    return ChatResponse(
        reply=reply,
        ticket=ticket,
        timestamp=datetime.utcnow().isoformat(),
    )

@app.get("/health")
async def health():
    return {"status": "ok", "model": GEMINI_MODEL}
