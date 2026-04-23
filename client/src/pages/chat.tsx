import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Plus, Trash2, MessageSquare, ChevronLeft,
  ExternalLink, Copy, Check, Loader2, Menu, X, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { pendingQuery, setPendingQuery, selectedLanguage, setSelectedLanguage, type Language } from "@/App";
import type { Conversation, Message } from "@shared/schema";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

const LANG_OPTIONS: { value: Language; label: string; flag: string }[] = [
  { value: "tr",    label: "Türkçe",          flag: "🇹🇷" },
  { value: "en",    label: "English",          flag: "🇬🇧" },
  { value: "tr_en", label: "Türkçe & English", flag: "🌐" },
];

function AzureLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Azure">
      <path d="M33.338 7.463L14.573 51.74 0 73.337h29.578l3.76-6.507L44.76 84.9l10.14-12.55-5.413-7.47 14.997-19.52L33.338 7.463z" fill="currentColor" opacity="0.9" />
      <path d="M50.8 12.1L35.493 56.377 53.71 80.257 96 80.25 50.8 12.1z" fill="currentColor" />
    </svg>
  );
}

interface StreamingMessage {
  content: string;
  isStreaming: boolean;
  sources: string[];
}

export default function ChatPage() {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const matchId = location.match(/\/chat\/(\d+)/);
  const [convId, setConvId] = useState<number | null>(matchId ? parseInt(matchId[1]) : null);

  const initialQuery = pendingQuery;

  const [input, setInput] = useState("");
  // Language can still be changed inside chat per message
  const [language, setLanguage] = useState<Language>(selectedLanguage);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasAutoSent = useRef(false);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    queryFn: () => apiRequest("GET", "/api/conversations").then((r) => r.json()),
  });

  const { data: convData, refetch: refetchConv } = useQuery<{ conversation: Conversation; messages: Message[] }>({
    queryKey: ["/api/conversations", convId],
    queryFn: () => apiRequest("GET", `/api/conversations/${convId}`).then((r) => r.json()),
    enabled: !!convId,
  });

  const messages = convData?.messages || [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/conversations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      setConvId(null);
      navigate("/chat");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming?.content]);

  useEffect(() => {
    if (initialQuery && !hasAutoSent.current && !convId) {
      hasAutoSent.current = true;
      setPendingQuery("");
      setTimeout(() => sendMessage(initialQuery), 150);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || streaming) return;
    setInput("");
    setStreaming({ content: "", isStreaming: true, sources: [] });

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText, conversationId: convId, language }),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => "");
        throw new Error(`API hatası ${response.status}: ${errText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let newConvId = convId;
      let lastEventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            lastEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (lastEventType === "conversation" && data.id) {
                newConvId = data.id;
                setConvId(data.id);
                navigate(`/chat/${data.id}`);
                qc.invalidateQueries({ queryKey: ["/api/conversations"] });
              } else if (lastEventType === "chunk" && data.text !== undefined) {
                setStreaming((prev) =>
                  prev ? { ...prev, content: prev.content + data.text } : null
                );
              } else if (lastEventType === "done" && data.sources !== undefined) {
                setStreaming((prev) =>
                  prev ? { ...prev, sources: data.sources, isStreaming: false } : null
                );
                await new Promise((r) => setTimeout(r, 300));
                setStreaming(null);
                if (newConvId) {
                  qc.invalidateQueries({ queryKey: ["/api/conversations", newConvId] });
                  refetchConv();
                }
                qc.invalidateQueries({ queryKey: ["/api/conversations"] });
              } else if (lastEventType === "error") {
                throw new Error(data.error || "Sunucu hatası");
              }
            } catch {
              // skip
            }
            lastEventType = "";
          }
        }
      }
    } catch (err: any) {
      console.error("sendMessage error:", err);
      setStreaming(null);
      toast({
        title: "Hata",
        description: err?.message || "Yanıt alınamadı. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }

    inputRef.current?.focus();
  }, [input, convId, language, streaming, navigate, qc, refetchConv, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeLang = LANG_OPTIONS.find((o) => o.value === language)!;
  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`${sidebarOpen ? "w-64" : "w-0"} flex-shrink-0 transition-all duration-200 overflow-hidden border-r border-border bg-card flex flex-col`}
      >
        <div className="p-3 flex items-center gap-2 border-b border-border">
          <Link href="/">
            <div className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer group">
              <AzureLogo className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                Azure Mühendis
              </span>
            </div>
          </Link>
          <Button
            data-testid="button-new-chat"
            variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
            onClick={() => { setConvId(null); navigate("/chat"); }}
            title="Yeni sohbet"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-4">Henüz sohbet yok</p>
          ) : (
            <div className="px-2 space-y-0.5">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  data-testid={`conversation-item-${c.id}`}
                  className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    convId === c.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => { setConvId(c.id); navigate(`/chat/${c.id}`); }}
                >
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs truncate flex-1">{c.title}</span>
                  <Button
                    variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(c.id); }}
                    data-testid={`button-delete-conv-${c.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="w-3 h-3 text-primary" />
            <span>Yalnızca Microsoft kaynakları</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm flex-shrink-0">
          <Button
            data-testid="button-toggle-sidebar"
            variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" data-testid="button-home">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <AzureLogo className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-semibold text-foreground hidden sm:block">Azure Çözüm Mühendisi</h1>
          </div>

          {/* Active language badge + change buttons */}
          <div className="ml-auto flex items-center gap-1.5">
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                data-testid={`button-lang-${opt.value}`}
                onClick={() => { setLanguage(opt.value); setSelectedLanguage(opt.value); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  language === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span>{opt.flag}</span>
                <span className="hidden md:inline">{opt.label}</span>
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-1 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>MS Resmi</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                  <AzureLogo className="w-9 h-9 text-white" />
                </div>
                <h2 className="text-base font-semibold text-foreground mb-1">Azure Çözüm Mühendisi</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Azure hakkında herhangi bir sorunuzu sorun.
                </p>
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20">
                  <span className="text-base">{activeLang.flag}</span>
                  <span className="text-xs font-medium text-primary">{activeLang.label} yanıt modu aktif</span>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} copiedId={copiedId} onCopy={copyToClipboard} />
            ))}

            {streaming && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
                    <AzureLogo className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">Azure Mühendisi</span>
                  {streaming.isStreaming && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
                </div>
                <div className="bg-card border border-border rounded-xl p-4 ml-8">
                  <div className={`markdown-content ${streaming.isStreaming && streaming.content ? "streaming-cursor" : ""}`}>
                    {streaming.content ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming.content}</ReactMarkdown>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Yanıt hazırlanıyor...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-border bg-background/80 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end bg-card border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all shadow-sm">
              <textarea
                ref={inputRef}
                data-testid="textarea-message"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  language === "en"
                    ? "Ask your Azure question... (Enter to send)"
                    : "Azure hakkında sorunuzu yazın... (Enter ile gönder)"
                }
                rows={1}
                disabled={!!streaming}
                className="flex-1 bg-transparent resize-none px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none min-h-[48px] max-h-40 leading-relaxed disabled:opacity-50"
              />
              <Button
                data-testid="button-send"
                onClick={() => sendMessage()}
                disabled={!input.trim() || !!streaming}
                className="m-2 h-8 w-8 p-0 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40"
              >
                {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Yanıtlar yalnızca{" "}
              <a href="https://learn.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Learn</a>
              {", "}
              <a href="https://docs.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Docs</a>
              {" "}ve resmi Azure kaynaklarından alınır.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, copiedId, onCopy }: { msg: Message; copiedId: number | null; onCopy: (text: string, id: number) => void }) {
  const sources = (() => { try { return JSON.parse(msg.sources) as string[]; } catch { return []; } })();

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div data-testid={`message-user-${msg.id}`} className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] text-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`message-assistant-${msg.id}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 96 96" fill="none">
            <path d="M33.338 7.463L14.573 51.74 0 73.337h29.578l3.76-6.507L44.76 84.9l10.14-12.55-5.413-7.47 14.997-19.52L33.338 7.463z" fill="currentColor" opacity="0.9" />
            <path d="M50.8 12.1L35.493 56.377 53.71 80.257 96 80.25 50.8 12.1z" fill="currentColor" />
          </svg>
        </div>
        <span className="text-xs font-medium text-muted-foreground">Azure Mühendisi</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 ml-auto opacity-60 hover:opacity-100"
          onClick={() => onCopy(msg.content, msg.id)} data-testid={`button-copy-${msg.id}`} title="Kopyala">
          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 ml-8">
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
        {sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> Microsoft Resmi Kaynaklar
            </p>
            <div className="space-y-1">
              {sources.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs text-primary hover:underline break-all"
                  data-testid={`source-link-${msg.id}-${i}`}>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5" />{src}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
