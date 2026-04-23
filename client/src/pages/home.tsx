import { useState } from "react";
import { useLocation } from "wouter";
import { Search, Cloud, Zap, Shield, BarChart3, Server, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPendingQuery, setSelectedLanguage, type Language } from "@/App";

const SUGGESTIONS = [
  "Azure Kubernetes Service (AKS) nedir ve nasıl kurulur?",
  "Azure OpenAI Service ile GPT-4 nasıl kullanılır?",
  "Azure Well-Architected Framework'ün 5 sütunu nelerdir?",
  "Azure DevOps CI/CD pipeline kurulumu",
];

const QUICK_TOPICS = [
  { icon: Cloud,     label: "Compute",    query: "Azure Compute hizmetleri nelerdir? VM, AKS, App Service karşılaştırması" },
  { icon: Database,  label: "Data & AI",  query: "Azure veri ve yapay zeka hizmetleri: Azure SQL, Cosmos DB, Azure OpenAI" },
  { icon: Shield,    label: "Güvenlik",   query: "Azure güvenlik best practices ve Zero Trust mimarisi" },
  { icon: Globe,     label: "Networking", query: "Azure networking: VNet, ExpressRoute, Azure Firewall mimarisi" },
  { icon: BarChart3, label: "Monitoring", query: "Azure Monitor, Application Insights ve Log Analytics kurulumu" },
  { icon: Server,    label: "DevOps",     query: "Azure DevOps ve GitHub Actions ile CI/CD pipeline best practices" },
];

const LANG_OPTIONS: { value: Language; label: string; flag: string; desc: string }[] = [
  { value: "tr",    label: "Türkçe",          flag: "🇹🇷", desc: "Yanıtlar Türkçe gelir" },
  { value: "en",    label: "English",          flag: "🇬🇧", desc: "Responses in English" },
  { value: "tr_en", label: "Türkçe & English", flag: "🌐", desc: "Her iki dilde yanıt" },
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<Language>("tr");
  const [, navigate] = useLocation();

  const handleSearch = (q?: string) => {
    const searchQuery = q || query.trim();
    if (!searchQuery) return;
    setSelectedLanguage(language);
    setPendingQuery(searchQuery);
    navigate("/chat");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleLangSelect = (lang: Language) => {
    setLanguage(lang);
    setSelectedLanguage(lang);
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <AzureLogo className="w-7 h-7 text-primary" />
          <span className="font-semibold text-foreground text-sm">Azure Çözüm Mühendisi</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Microsoft resmi kaynaklardan yanıt verir
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16">

        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <AzureLogo className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Azure Çözüm Mühendisi</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Microsoft'un resmi kaynaklarından güvenilir Azure yanıtları
            </p>
          </div>
        </div>

        {/* ── LANGUAGE SELECTOR ── */}
        <div className="w-full max-w-2xl mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">
            Yanıt Dili Seçin
          </p>
          <div className="grid grid-cols-3 gap-3">
            {LANG_OPTIONS.map((opt) => {
              const active = language === opt.value;
              return (
                <button
                  key={opt.value}
                  data-testid={`button-lang-home-${opt.value}`}
                  onClick={() => handleLangSelect(opt.value)}
                  className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl border-2 transition-all duration-150 ${
                    active
                      ? "border-primary bg-primary/8 shadow-sm shadow-primary/20"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <span className="text-2xl leading-none">{opt.flag}</span>
                  <span className={`text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  {active && (
                    <span className="mt-0.5 w-2 h-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SEARCH BOX ── */}
        <div className="w-full max-w-2xl">
          <div className="relative flex items-center bg-card border-2 border-border rounded-2xl shadow-md hover:shadow-lg transition-shadow focus-within:ring-0 focus-within:border-primary">
            <Search className="absolute left-4 w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              data-testid="input-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                language === "en"
                  ? "What would you like to know about Azure?"
                  : "Azure hakkında ne öğrenmek istiyorsunuz?"
              }
              className="w-full pl-12 pr-28 py-4 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none rounded-2xl"
              autoFocus
            />
            <Button
              data-testid="button-search"
              onClick={() => handleSearch()}
              disabled={!query.trim()}
              className="absolute right-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-4 py-2 h-9 rounded-xl font-semibold"
            >
              {language === "en" ? "Ask" : "Sor"}
            </Button>
          </div>

          {/* Suggestions */}
          <div className="mt-3 flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                data-testid={`button-suggestion-${s.slice(0, 20)}`}
                onClick={() => handleSearch(s)}
                className="text-xs text-muted-foreground bg-muted hover:bg-muted/80 hover:text-primary border border-border px-3 py-1.5 rounded-full transition-colors text-left"
              >
                {s.length > 45 ? s.slice(0, 45) + "…" : s}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Topics */}
        <div className="w-full max-w-2xl mt-8">
          <p className="text-xs font-semibold text-muted-foreground mb-3 text-center uppercase tracking-wider">Hızlı Konular</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {QUICK_TOPICS.map(({ icon: Icon, label, query: q }) => (
              <button
                key={label}
                data-testid={`button-topic-${label}`}
                onClick={() => handleSearch(q)}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border">
        Yalnızca Microsoft resmi kaynaklarını kullanır ·{" "}
        <a href="https://learn.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          Microsoft Learn
        </a>
        {" "}·{" "}
        <a href="https://azure.microsoft.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          Azure.com
        </a>
      </footer>
    </div>
  );
}

function AzureLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Azure logo">
      <path d="M33.338 7.463L14.573 51.74 0 73.337h29.578l3.76-6.507L44.76 84.9l10.14-12.55-5.413-7.47 14.997-19.52L33.338 7.463z" fill="currentColor" opacity="0.9" />
      <path d="M50.8 12.1L35.493 56.377 53.71 80.257 96 80.25 50.8 12.1z" fill="currentColor" />
    </svg>
  );
}
