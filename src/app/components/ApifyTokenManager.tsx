import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { apiService, type ApifyToken } from "../services/api.service";

interface ApifyTokenManagerProps {
  onTokenChanged?: () => void;
  compact?: boolean;
}

export function ApifyTokenManager({ onTokenChanged, compact = false }: ApifyTokenManagerProps) {
  const [tokens, setTokens] = useState<ApifyToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // New Token Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenValue, setTokenValue] = useState("");
  const [actorId, setActorId] = useState("dan.k/google-scholar-scraper");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getApifyTokens();
      setTokens(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.warn("Could not load Apify tokens:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenValue.trim()) {
      setStatusMessage({ type: "error", text: "Apify API Token is required." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await apiService.addApifyToken({
        name: tokenName.trim() || undefined,
        token: tokenValue.trim(),
        actorId: actorId.trim() || undefined,
      });

      setStatusMessage({
        type: res.token?.status === "valid" ? "success" : "info",
        text: res.message || "Token connected!",
      });

      setTokenValue("");
      setTokenName("");
      setShowAddForm(false);
      await fetchTokens();
      onTokenChanged?.();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to add token" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await apiService.activateApifyToken(id);
      await fetchTokens();
      onTokenChanged?.();
      setStatusMessage({ type: "success", text: "Active scraper token updated." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to set active token" });
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setStatusMessage(null);
    try {
      const res = await apiService.testApifyToken(id);
      setStatusMessage({
        type: res.status === "valid" ? "success" : "error",
        text: res.message || (res.status === "valid" ? "Token verified with Apify!" : "Token verification failed."),
      });
      await fetchTokens();
      onTokenChanged?.();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Test failed" });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this Apify token?")) return;
    try {
      await apiService.deleteApifyToken(id);
      await fetchTokens();
      onTokenChanged?.();
      setStatusMessage({ type: "info", text: "Token removed." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to delete token" });
    }
  };

  const activeToken = tokens.find((t) => t.isActive);

  return (
    <Card className={`border shadow-sm ${compact ? "bg-white" : ""}`}>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Apify Scraper Integration
                {activeToken && activeToken.status === "valid" && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1 inline" /> Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Powers live Google Scholar scraping with automated token rotation and failover
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTokens}
              disabled={isLoading}
              title="Refresh tokens"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            {!showAddForm && (
              <Button
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Token
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status notification banner */}
        {statusMessage && (
          <div
            className={`p-3 rounded-lg text-sm flex items-start justify-between gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : statusMessage.type === "error"
                ? "bg-rose-50 text-rose-900 border border-rose-200"
                : "bg-blue-50 text-blue-900 border border-blue-200"
            }`}
          >
            <p className="leading-snug">{statusMessage.text}</p>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-gray-400 hover:text-gray-700 text-xs font-semibold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Add Token Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddToken}
            className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 space-y-3"
          >
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-sm font-semibold text-blue-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" /> Connect Apify Account Token
              </h4>
              <a
                href="https://console.apify.com/account/integrations"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                Get token from Apify <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="token-name" className="text-xs text-gray-700">
                  Token Label (Optional)
                </Label>
                <Input
                  id="token-name"
                  placeholder="e.g. Primary Free Tier, Research Lab Account"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="bg-white text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="actor-id" className="text-xs text-gray-700">
                  Apify Actor ID
                </Label>
                <Input
                  id="actor-id"
                  value={actorId}
                  onChange={(e) => setActorId(e.target.value)}
                  placeholder="dan.k/google-scholar-scraper"
                  className="bg-white text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="apify-token" className="text-xs font-medium text-gray-800">
                Apify API Token *
              </Label>
              <Input
                id="apify-token"
                type="password"
                placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                required
                className="bg-white font-mono text-sm"
              />
              <p className="text-[11px] text-gray-500">
                Tokens are verified immediately against Apify and stored encrypted in your local SQLite database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-1.5" /> Verify & Connect
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Token List */}
        {tokens.length === 0 ? (
          <div className="text-center py-6 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Zap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <h5 className="text-sm font-semibold text-gray-800">No Apify tokens configured</h5>
            <p className="text-xs text-gray-600 max-w-md mx-auto mt-1 mb-3">
              Connect a free Apify API token to start live scraping Google Scholar publications. Apify provides $5 free monthly usage for scraping.
            </p>
            <Button
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-1" /> Connect Free Apify Token
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((tok) => {
              const isTesting = testingId === tok.id;
              return (
                <div
                  key={tok.id}
                  className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    tok.isActive
                      ? "bg-blue-50/40 border-blue-300 ring-1 ring-blue-200"
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{tok.name}</span>
                      {tok.isActive && (
                        <Badge className="bg-blue-600 text-white text-[11px] font-medium py-0">
                          Active Scraper
                        </Badge>
                      )}
                      {tok.status === "valid" ? (
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 text-[11px] py-0">
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                          {tok.username ? `@${tok.username}` : "Valid"} {tok.plan ? `(${tok.plan})` : ""}
                        </Badge>
                      ) : tok.status === "invalid" ? (
                        <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-300 text-[11px] py-0">
                          <XCircle className="w-3 h-3 mr-1 inline" /> Invalid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600 bg-gray-50 text-[11px] py-0">
                          <Clock className="w-3 h-3 mr-1 inline" /> Untested
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 font-mono flex items-center gap-3">
                      <span>Token: {tok.maskedToken}</span>
                      <span>•</span>
                      <span>Actor: {tok.actorId}</span>
                    </div>

                    {tok.lastTestedAt && (
                      <p className="text-[11px] text-gray-400">
                        Tested: {new Date(tok.lastTestedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(tok.id)}
                      disabled={isTesting}
                      className="text-xs h-8"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isTesting ? "animate-spin" : ""}`} />
                      {isTesting ? "Testing..." : "Test"}
                    </Button>

                    {!tok.isActive && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleActivate(tok.id)}
                        className="text-xs h-8 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        Set Active
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tok.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2"
                      title="Remove token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tip footer */}
        <div className="pt-2 text-[11px] text-gray-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            <strong>Failover Architecture:</strong> When multiple tokens exist, if the active token exceeds its monthly quota, the server automatically tries remaining tokens.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
