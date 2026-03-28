import { NextRequest, NextResponse } from "next/server";
import { getLogById } from "@/lib/forensic-logger";

const ADMIN_KEY = process.env.ADMIN_API_KEY || "deepfake-shield-admin-2024";

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key");
  
  if (apiKey === ADMIN_KEY) return true;
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === ADMIN_KEY) return true;
  
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized. Provide valid API key in x-api-key header." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const log = getLogById(id);

  if (!log) {
    return NextResponse.json(
      { error: "Log not found", id },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    log,
  });
}
