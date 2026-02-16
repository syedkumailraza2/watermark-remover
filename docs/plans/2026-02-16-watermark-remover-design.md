# PDF Watermark Remover - Design Document

**Date:** 2026-02-16
**Status:** Approved

## Overview

A web-based tool to remove watermarks from PDF files. Supports text and image watermarks with manual selection. Hybrid processing (client-side for simple cases, server for complex).

## Requirements

- **Watermark types:** Text-based and image/logo watermarks
- **Processing:** Hybrid (client-side primary, server fallback)
- **Use case:** Public web tool with polished UI
- **Detection:** Manual selection (user draws rectangle)
- **Stack:** Next.js 14

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Upload UI  │  │ PDF Preview  │  │ Watermark Selector│  │
│  │ (drag-drop) │  │ (pdf.js)     │  │ (canvas overlay)  │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
    ┌─────────▼─────────┐      ┌───────────▼───────────┐
    │  Client-side      │      │  Server API Route     │
    │  (pdf-lib/canvas) │      │  (pdf-lib + sharp)    │
    │  Simple removal   │      │  Complex removal      │
    └───────────────────┘      └───────────────────────┘
```

## User Flow

1. User uploads PDF (client-side, no immediate server upload)
2. PDF renders in browser using pdf.js
3. User draws a rectangle over the watermark on any page
4. Tool applies removal to all pages
5. Simple cases: process entirely in browser
6. Complex cases: send to server API route

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with upload zone |
| `/editor` | Main PDF editor with watermark selection |
| `/api/remove-watermark` | Server API route |

## Components

### Upload
- **UploadZone** - Drag-drop with file validation (PDF only, size limits)

### PDF Viewer
- **PDFViewer** - Renders PDF using pdf.js with canvas overlay
- **PageThumbnails** - Sidebar navigation
- **ZoomControls** - Zoom in/out/fit

### Editor
- **WatermarkSelector** - Rectangle selection tool
- **SelectionHandles** - Resize handles
- **PreviewToggle** - Before/after preview

### Processing
- **ProcessingPanel** - Progress display
- **DownloadButton** - Download result

## Watermark Removal Techniques

### Object Removal (Text/Vector)
- Parse PDF structure with pdf-lib
- Find objects within selection bounds
- Remove matching objects
- Rebuild PDF

### Pixel Redaction (Image-based)
- Render page to image
- Apply content-aware fill with sharp
- Replace page content

### Processing Decision

| Condition | Processing |
|-----------|------------|
| File < 10MB, text watermark | Client |
| File > 10MB | Server |
| Image watermark needing fill | Server |
| Complex multi-layer watermark | Server |

## API Specification

### POST /api/remove-watermark

**Request (multipart/form-data):**
- `file`: PDF blob
- `selection`: `{ x, y, width, height, page?: number }`
- `mode`: `"object" | "pixel" | "auto"`
- `applyToAll`: boolean

**Response:**
- Success: PDF blob (`application/pdf`)
- Error: `{ error: string, code: string }`

**Limits:**
- Rate limit: 10 requests/minute per IP
- Max file size: 100MB
- Files deleted immediately after processing

## Dependencies

```json
{
  "next": "^14.x",
  "react": "^18.x",
  "pdf-lib": "^1.17.x",
  "pdfjs-dist": "^4.x",
  "sharp": "^0.33.x",
  "tailwindcss": "^3.x",
  "lucide-react": "^0.x"
}
```

## Project Structure

```
watermark-remover/
├── app/
│   ├── page.tsx
│   ├── editor/page.tsx
│   ├── api/remove-watermark/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── upload/UploadZone.tsx
│   ├── pdf/PDFViewer.tsx, PageThumbnails.tsx, ZoomControls.tsx
│   ├── editor/WatermarkSelector.tsx, SelectionHandles.tsx, PreviewToggle.tsx
│   ├── processing/ProcessingPanel.tsx, DownloadButton.tsx
│   └── ui/Button.tsx, Card.tsx, Progress.tsx
├── lib/
│   ├── pdf/parser.ts, remover.ts, renderer.ts
│   ├── processing/client.ts, server.ts
│   └── utils/bounds.ts, validation.ts
├── hooks/usePDF.ts, useSelection.ts, useProcessing.ts
└── public/pdf.worker.min.js
```

## Implementation Phases

1. **Core Foundation** - Next.js setup, landing page, PDF rendering
2. **Selection Tool** - Canvas overlay, rectangle drawing, resize handles
3. **Client-Side Removal** - pdf-lib integration, object removal
4. **Server Processing** - API route, pixel-based removal
5. **Polish** - Preview toggle, batch processing, dark mode, mobile
