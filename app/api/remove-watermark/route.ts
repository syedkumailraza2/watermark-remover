import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SelectionData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const selectionStr = formData.get("selection") as string | null;
    const scaleStr = formData.get("scale") as string | null;
    const applyToAllStr = formData.get("applyToAll") as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: "No file provided", code: "NO_FILE" },
        { status: 400 }
      );
    }

    if (!selectionStr) {
      return NextResponse.json(
        { error: "No selection provided", code: "NO_SELECTION" },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF", code: "INVALID_FILE_TYPE" },
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 100MB limit", code: "FILE_TOO_LARGE" },
        { status: 400 }
      );
    }

    // Parse options
    let selection: SelectionData;
    try {
      selection = JSON.parse(selectionStr);
    } catch {
      return NextResponse.json(
        { error: "Invalid selection data", code: "INVALID_SELECTION" },
        { status: 400 }
      );
    }

    const scale = parseFloat(scaleStr || "1.5");
    const applyToAllPages = applyToAllStr === "true";

    // Load PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    const totalPages = applyToAllPages ? pages.length : 1;

    // Process each page
    for (let i = 0; i < totalPages; i++) {
      const page = pages[i];
      const { height } = page.getSize();

      // Convert canvas coordinates to PDF coordinates
      const pdfX = selection.x / scale;
      const pdfY = height - (selection.y + selection.height) / scale;
      const pdfWidth = selection.width / scale;
      const pdfHeight = selection.height / scale;

      // Draw white rectangle over watermark
      page.drawRectangle({
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
        color: rgb(1, 1, 1),
        opacity: 1,
      });
    }

    // Save and return
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=processed.pdf",
        "X-Pages-Processed": totalPages.toString(),
      },
    });
  } catch (error) {
    console.error("Error processing PDF:", error);
    return NextResponse.json(
      {
        error: "Failed to process PDF",
        code: "PROCESSING_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
