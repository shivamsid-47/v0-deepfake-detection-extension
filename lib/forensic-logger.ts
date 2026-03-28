import crypto from "crypto";

export interface ForensicLog {
  id: string;
  timestamp: string;
  timestampUnix: number;
  type: "image" | "video" | "audio";
  verdict: "authentic" | "uncertain" | "deepfake";
  confidence: number;
  scores: {
    fake: number;
    real: number;
  };
  fileHash: string;
  fileSize: number;
  mimeType: string;
  sourceIP: string;
  userAgent: string;
  analysisDetails: {
    modelsUsed: string[];
    processingTimeMs: number;
    indicators: Record<string, number>;
  };
  metadata: {
    referer?: string;
    origin?: string;
    sessionId: string;
  };
}

export interface LogQuery {
  type?: "image" | "video" | "audio";
  verdict?: "authentic" | "uncertain" | "deepfake";
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// In-memory store (in production, use a database)
const forensicLogs: ForensicLog[] = [];
const MAX_LOGS = 10000;

export function generateFileHash(data: Buffer | ArrayBuffer): string {
  const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : data;
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function generateLogId(): string {
  return `DFS-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function generateSessionId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function createForensicLog(params: {
  type: "image" | "video" | "audio";
  verdict: "authentic" | "uncertain" | "deepfake";
  confidence: number;
  scores: { fake: number; real: number };
  fileData: Buffer | ArrayBuffer;
  fileSize: number;
  mimeType: string;
  sourceIP: string;
  userAgent: string;
  modelsUsed: string[];
  processingTimeMs: number;
  indicators: Record<string, number>;
  referer?: string;
  origin?: string;
}): ForensicLog {
  const now = new Date();
  
  const log: ForensicLog = {
    id: generateLogId(),
    timestamp: now.toISOString(),
    timestampUnix: now.getTime(),
    type: params.type,
    verdict: params.verdict,
    confidence: params.confidence,
    scores: params.scores,
    fileHash: generateFileHash(params.fileData),
    fileSize: params.fileSize,
    mimeType: params.mimeType,
    sourceIP: params.sourceIP,
    userAgent: params.userAgent,
    analysisDetails: {
      modelsUsed: params.modelsUsed,
      processingTimeMs: params.processingTimeMs,
      indicators: params.indicators,
    },
    metadata: {
      referer: params.referer,
      origin: params.origin,
      sessionId: generateSessionId(),
    },
  };

  // Add to store (circular buffer)
  if (forensicLogs.length >= MAX_LOGS) {
    forensicLogs.shift();
  }
  forensicLogs.push(log);

  return log;
}

export function queryLogs(query: LogQuery = {}): {
  logs: ForensicLog[];
  total: number;
  query: LogQuery;
} {
  let filtered = [...forensicLogs];

  // Filter by type
  if (query.type) {
    filtered = filtered.filter((log) => log.type === query.type);
  }

  // Filter by verdict
  if (query.verdict) {
    filtered = filtered.filter((log) => log.verdict === query.verdict);
  }

  // Filter by date range
  if (query.startDate) {
    const startTime = new Date(query.startDate).getTime();
    filtered = filtered.filter((log) => log.timestampUnix >= startTime);
  }

  if (query.endDate) {
    const endTime = new Date(query.endDate).getTime();
    filtered = filtered.filter((log) => log.timestampUnix <= endTime);
  }

  // Sort by most recent first
  filtered.sort((a, b) => b.timestampUnix - a.timestampUnix);

  const total = filtered.length;

  // Pagination
  const offset = query.offset || 0;
  const limit = query.limit || 50;
  filtered = filtered.slice(offset, offset + limit);

  return {
    logs: filtered,
    total,
    query,
  };
}

export function getLogById(id: string): ForensicLog | null {
  return forensicLogs.find((log) => log.id === id) || null;
}

export function getStatistics(): {
  total: number;
  byType: Record<string, number>;
  byVerdict: Record<string, number>;
  last24Hours: number;
  last7Days: number;
  deepfakeRate: number;
} {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const byType: Record<string, number> = { image: 0, video: 0, audio: 0 };
  const byVerdict: Record<string, number> = { authentic: 0, uncertain: 0, deepfake: 0 };
  let last24Hours = 0;
  let last7Days = 0;

  for (const log of forensicLogs) {
    byType[log.type] = (byType[log.type] || 0) + 1;
    byVerdict[log.verdict] = (byVerdict[log.verdict] || 0) + 1;

    if (now - log.timestampUnix < day) {
      last24Hours++;
    }
    if (now - log.timestampUnix < 7 * day) {
      last7Days++;
    }
  }

  const deepfakeRate =
    forensicLogs.length > 0
      ? (byVerdict.deepfake / forensicLogs.length) * 100
      : 0;

  return {
    total: forensicLogs.length,
    byType,
    byVerdict,
    last24Hours,
    last7Days,
    deepfakeRate: Math.round(deepfakeRate * 100) / 100,
  };
}

export function exportLogsAsCSV(logs: ForensicLog[]): string {
  const headers = [
    "ID",
    "Timestamp",
    "Type",
    "Verdict",
    "Confidence",
    "Fake Score",
    "Real Score",
    "File Hash (SHA-256)",
    "File Size (bytes)",
    "MIME Type",
    "Source IP",
    "User Agent",
    "Models Used",
    "Processing Time (ms)",
    "Session ID",
  ];

  const rows = logs.map((log) => [
    log.id,
    log.timestamp,
    log.type,
    log.verdict,
    log.confidence.toFixed(4),
    log.scores.fake.toFixed(4),
    log.scores.real.toFixed(4),
    log.fileHash,
    log.fileSize.toString(),
    log.mimeType,
    log.sourceIP,
    `"${log.userAgent.replace(/"/g, '""')}"`,
    `"${log.analysisDetails.modelsUsed.join(", ")}"`,
    log.analysisDetails.processingTimeMs.toString(),
    log.metadata.sessionId,
  ]);

  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function exportLogsAsJSON(logs: ForensicLog[]): string {
  return JSON.stringify(
    {
      exportDate: new Date().toISOString(),
      exportedBy: "DeepFake Shield Forensic Logger",
      version: "1.0.0",
      totalRecords: logs.length,
      records: logs,
    },
    null,
    2
  );
}
