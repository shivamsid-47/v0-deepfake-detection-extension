import { NextResponse } from "next/server";
import JSZip from "jszip";
import { promises as fs } from "fs";
import path from "path";

async function addFolderToZip(
  zip: JSZip,
  folderPath: string,
  zipFolderPath: string = ""
) {
  const entries = await fs.readdir(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    const zipPath = zipFolderPath ? `${zipFolderPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await addFolderToZip(zip, fullPath, zipPath);
    } else {
      const content = await fs.readFile(fullPath);
      zip.file(zipPath, content);
    }
  }
}

export async function GET() {
  try {
    const zip = new JSZip();
    const extensionFolder = path.join(process.cwd(), "public", "extension");

    // Check if folder exists
    try {
      await fs.access(extensionFolder);
    } catch {
      return NextResponse.json(
        { error: "Extension folder not found" },
        { status: 404 }
      );
    }

    // Add all files from extension folder to zip
    await addFolderToZip(zip, extensionFolder, "deepfake-shield-extension");

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    // Return as downloadable file
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="deepfake-shield-extension.zip"',
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error creating zip:", error);
    return NextResponse.json(
      { error: "Failed to create extension zip" },
      { status: 500 }
    );
  }
}
