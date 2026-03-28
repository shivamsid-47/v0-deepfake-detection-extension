import { NextRequest, NextResponse } from "next/server";
import {
  queryLogs,
  getStatistics,
  exportLogsAsCSV,
  exportLogsAsJSON,
  type LogQuery,
} from "@/lib/forensic-logger";

// Simple auth check - in production use proper authentication
const ADMIN_KEY = process.env.ADMIN_API_KEY || "deepfake-shield-admin-2024";

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key");
  
  if (apiKey === ADMIN_KEY) return true;
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === ADMIN_KEY) return true;
  
  return false;
}

export async function GET(request: NextRequest) {
  // Check authentication
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid API key in x-api-key header." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  
  const action = searchParams.get("action") || "query";
  
  if (action === "stats") {
    const stats = getStatistics();
    return NextResponse.json({
      success: true,
      statistics: stats,
    });
  }

  if (action === "export") {
    const format = searchParams.get("format") || "json";
    const query: LogQuery = {
      type: searchParams.get("type") as LogQuery["type"],
      verdict: searchParams.get("verdict") as LogQuery["verdict"],
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      limit: 10000, // Export all matching
    };

    const { logs } = queryLogs(query);

    if (format === "csv") {
      const csv = exportLogsAsCSV(logs);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="deepfake-shield-logs-${Date.now()}.csv"`,
        },
      });
    } else {
      const json = exportLogsAsJSON(logs);
      return new NextResponse(json, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="deepfake-shield-logs-${Date.now()}.json"`,
        },
      });
    }
  }

  // Default: query logs
  const query: LogQuery = {
    type: searchParams.get("type") as LogQuery["type"],
    verdict: searchParams.get("verdict") as LogQuery["verdict"],
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    limit: parseInt(searchParams.get("limit") || "50"),
    offset: parseInt(searchParams.get("offset") || "0"),
  };

  const result = queryLogs(query);

  return NextResponse.json({
    success: true,
    ...result,
  });
}
