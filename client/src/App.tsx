import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "@/pages/home";
import ChatPage from "@/pages/chat";
import NotFound from "@/pages/not-found";

// Global store for passing initial query from home to chat
// Avoids URL query param issues with hash routing (?q= breaks wouter)
export let pendingQuery = "";
export function setPendingQuery(q: string) { pendingQuery = q; }

// Global language preference — set on home page, used in chat
export type Language = "tr" | "en" | "tr_en";
export let selectedLanguage: Language = "tr";
export function setSelectedLanguage(lang: Language) { selectedLanguage = lang; }

function AppRoutes() {
  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/chat/:id" component={ChatPage} />
        <Route component={NotFound} />
      </Switch>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
