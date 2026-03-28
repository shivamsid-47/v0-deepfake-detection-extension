"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Download, Search, AlertTriangle, CheckCircle, HelpCircle, Lock, FileText, BarChart3 } from "lucide-react";
import Link from "next/link";

interface ForensicLog {
  id: string;
  timestamp: string;
  type: "image" | "video" | "audio";
  verdict: "authentic" | "uncertain" | "deepfake";
  confidence: number;
  scores: { fake: number; real: number };
  fileHash: string;
  fileSize: number;
  sourceIP: string;
  userAgent: string;
  analysisDetails: {
    modelsUsed: string[];
    processingTimeMs: number;
  };
}

interface Statistics {
  total: number;
  byType: Record<string, number>;
  byVerdict: Record<string, number>;
  last24Hours: number;
  last7Days: number;
  deepfakeRate: number;
}

export default function LawEnforcementDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [logs, setLogs] = useState<ForensicLog[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    type: "",
    verdict: "",
    startDate: "",
    endDate: "",
  });

  const authenticate = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/logs?action=stats", {
        headers: { "x-api-key": apiKey },
      });

      if (response.ok) {
        setIsAuthenticated(true);
        localStorage.setItem("le-api-key", apiKey);
        await loadData();
      } else {
        setError("Invalid API key. Please contact system administrator.");
      }
    } catch {
      setError("Connection error. Please try again.");
    }

    setLoading(false);
  };

  const loadData = async () => {
    const storedKey = localStorage.getItem("le-api-key") || apiKey;
    if (!storedKey) return;

    setLoading(true);

    try {
      // Load stats
      const statsResponse = await fetch("/api/logs?action=stats", {
        headers: { "x-api-key": storedKey },
      });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.statistics);
      }

      // Load logs with filters
      const params = new URLSearchParams();
      if (filters.type) params.set("type", filters.type);
      if (filters.verdict) params.set("verdict", filters.verdict);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      params.set("limit", "100");

      const logsResponse = await fetch(`/api/logs?${params.toString()}`, {
        headers: { "x-api-key": storedKey },
      });
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setLogs(logsData.logs);
      }
    } catch {
      setError("Failed to load data");
    }

    setLoading(false);
  };

  const exportLogs = async (format: "csv" | "json") => {
    const storedKey = localStorage.getItem("le-api-key") || apiKey;
    const params = new URLSearchParams();
    params.set("action", "export");
    params.set("format", format);
    if (filters.type) params.set("type", filters.type);
    if (filters.verdict) params.set("verdict", filters.verdict);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    const response = await fetch(`/api/logs?${params.toString()}`, {
      headers: { "x-api-key": storedKey },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deepfake-shield-logs-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    const storedKey = localStorage.getItem("le-api-key");
    if (storedKey) {
      setApiKey(storedKey);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, filters]);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "deepfake":
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Deepfake</Badge>;
      case "authentic":
        return <Badge variant="default" className="flex items-center gap-1 bg-green-600"><CheckCircle className="w-3 h-3" /> Authentic</Badge>;
      default:
        return <Badge variant="secondary" className="flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Uncertain</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      image: "bg-blue-600",
      video: "bg-purple-600",
      audio: "bg-orange-600",
    };
    return <Badge className={colors[type] || "bg-gray-600"}>{type}</Badge>;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Law Enforcement Access</CardTitle>
            <CardDescription>
              Enter your authorized API key to access the forensic logging dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && authenticate()}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button className="w-full" onClick={authenticate} disabled={loading || !apiKey}>
              {loading ? "Authenticating..." : "Access Dashboard"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This system is for authorized law enforcement use only. All access is logged.
            </p>
            <div className="pt-4 border-t">
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  <Shield className="w-4 h-4 mr-2" /> Back to Main Site
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">DeepFake Shield</h1>
              <p className="text-sm text-muted-foreground">Law Enforcement Forensic Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportLogs("csv")}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportLogs("json")}>
              <FileText className="w-4 h-4 mr-1" /> Export JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                localStorage.removeItem("le-api-key");
                setIsAuthenticated(false);
                setApiKey("");
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Scans</CardDescription>
                <CardTitle className="text-3xl">{stats.total}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {stats.last24Hours} in last 24h
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Deepfakes Detected</CardDescription>
                <CardTitle className="text-3xl text-red-500">
                  {stats.byVerdict.deepfake || 0}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {stats.deepfakeRate}% detection rate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>By Media Type</CardDescription>
                <CardTitle className="text-lg">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">Images: {stats.byType.image || 0}</Badge>
                    <Badge variant="outline">Videos: {stats.byType.video || 0}</Badge>
                    <Badge variant="outline">Audio: {stats.byType.audio || 0}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Last 7 Days</CardDescription>
                <CardTitle className="text-3xl">{stats.last7Days}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Scans performed
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" /> Filter Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Media Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.verdict} onValueChange={(v) => setFilters({ ...filters, verdict: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Verdict" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verdicts</SelectItem>
                  <SelectItem value="deepfake">Deepfake</SelectItem>
                  <SelectItem value="authentic">Authentic</SelectItem>
                  <SelectItem value="uncertain">Uncertain</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
              <Input
                type="date"
                placeholder="End Date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Detection Logs
            </CardTitle>
            <CardDescription>
              {logs.length} records found. All data is forensically logged with SHA-256 file hashes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs found. Detection events will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Log ID</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>File Hash (SHA-256)</TableHead>
                      <TableHead>Source IP</TableHead>
                      <TableHead>Processing Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.id}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>{getTypeBadge(log.type)}</TableCell>
                        <TableCell>{getVerdictBadge(log.verdict)}</TableCell>
                        <TableCell>{(log.confidence * 100).toFixed(1)}%</TableCell>
                        <TableCell className="font-mono text-xs max-w-[150px] truncate" title={log.fileHash}>
                          {log.fileHash.substring(0, 16)}...
                        </TableCell>
                        <TableCell className="text-sm">{log.sourceIP}</TableCell>
                        <TableCell>{log.analysisDetails.processingTimeMs}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Notice */}
        <div className="mt-8 p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Notice:</strong> This forensic logging system complies with digital evidence standards.
            All logs include cryptographic file hashes (SHA-256), timestamps, source IPs, and analysis metadata
            suitable for legal proceedings. Export logs in CSV or JSON format for case documentation.
          </p>
        </div>
      </main>
    </div>
  );
}
