import type { Express, Request, Response } from "express";
import { Server } from "http";
import { storage } from "./storage";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

type Language = "tr" | "en" | "tr_en";

function buildSystemPrompt(lang: Language): string {
  const langInstruction =
    lang === "tr"
      ? "DIL KURALI: Yanıtını YALNIZCA Türkçe ver. İngilizce yanıt verme."
      : lang === "en"
      ? "LANGUAGE RULE: Respond ONLY in English. Do not use Turkish."
      : `LANGUAGE RULE: Respond in BOTH Turkish and English. Structure your response as follows:
---
🇹🇷 TÜRKÇE YANIT
(Full answer in Turkish here)

---
🇬🇧 ENGLISH ANSWER
(Full answer in English here)
---`;

  return `You are an experienced Microsoft Azure Solution Engineer. You answer all Azure-related questions from users.

CORE RULES:
1. Use ONLY Microsoft's official sources:
   - learn.microsoft.com (Microsoft Learn)
   - docs.microsoft.com (Microsoft Docs)
   - azure.microsoft.com (Azure official site)
   - techcommunity.microsoft.com (Microsoft Tech Community)
   - github.com/Azure or github.com/MicrosoftDocs (official Azure GitHub)
   - blogs.microsoft.com (Microsoft Blog)

2. NEVER use unofficial sources (third-party blogs, Stack Overflow, YouTube, Medium, etc.).

3. Always present the MOST CURRENT information first. Mention current GA (Generally Available) products and features before older versions.

4. Structure your responses:
   - Short summary/introduction first
   - Technical details (code examples, architecture explanations, etc.)
   - Microsoft Learn links and sources
   - Best Practices and recommendations

5. Use Azure terminology correctly. When needed, use English technical terms alongside their explanations.

6. If your knowledge on a topic is insufficient or outdated, clearly state this and direct the user to official Microsoft documentation.

7. Always list relevant Microsoft Learn/Docs sources at the end of your responses.

8. Think like an Azure Solution Engineer: proactively suggest architectural decisions, cost optimization, security, scalability, and Microsoft best practices.

${langInstruction}`;
}

export function registerRoutes(httpServer: Server, app: Express) {
  // Get all conversations
  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/conversations", (_req: Request, res: Response) => {
    const convs = storage.getConversations();
    res.json(convs);
  });

  // Get a conversation and its messages
  app.get("/api/conversations/:id", (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const conv = storage.getConversation(id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    const msgs = storage.getMessages(id);
    res.json({ conversation: conv, messages: msgs });
  });

  // Delete conversation
  app.delete("/api/conversations/:id", (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    storage.deleteConversation(id);
    res.json({ success: true });
  });

  // Send a message — streaming SSE
  app.post("/api/chat", async (req: Request, res: Response) => {
    const { message, conversationId, language } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const lang: Language =
      language === "en" ? "en" : language === "tr_en" ? "tr_en" : "tr";

    let convId = conversationId;
    let isNew = false;

    // Create conversation if needed
    if (!convId) {
      const title = message.length > 60 ? message.slice(0, 57) + "..." : message;
      const conv = storage.createConversation({
        title,
        createdAt: new Date().toISOString(),
      });
      convId = conv.id;
      isNew = true;
    }

    // Save user message
    storage.createMessage({
      conversationId: convId,
      role: "user",
      content: message,
      sources: "[]",
      createdAt: new Date().toISOString(),
    });

    // Build message history for Claude
    const history = storage.getMessages(convId);
    const claudeMessages = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (isNew) {
      res.write(`event: conversation\ndata: ${JSON.stringify({ id: convId })}\n\n`);
    }

    let fullContent = "";

    try {
      const stream = anthropic.messages.stream({
        model: "claude-opus-4-7",
        max_tokens: 8096,
        system: buildSystemPrompt(lang),
        messages: claudeMessages,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const chunk = event.delta.text;
          fullContent += chunk;
          res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
        }
      }

      // Extract Microsoft source links from content
      const msSourcePattern =
        /https?:\/\/(learn\.microsoft\.com|docs\.microsoft\.com|azure\.microsoft\.com|techcommunity\.microsoft\.com|github\.com\/Azure|github\.com\/MicrosoftDocs|blogs\.microsoft\.com)[^\s\)\]"'<>]*/gi;
      const foundSources = [...new Set(fullContent.match(msSourcePattern) || [])];

      // Save assistant message
      storage.createMessage({
        conversationId: convId,
        role: "assistant",
        content: fullContent,
        sources: JSON.stringify(foundSources),
        createdAt: new Date().toISOString(),
      });

      res.write(
        `event: done\ndata: ${JSON.stringify({ sources: foundSources })}\n\n`
      );
      res.end();
    } catch (err: any) {
      console.error("LLM error:", err);
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "LLM hatası oluştu" })}\n\n`
      );
      res.end();
    }
  });
}
