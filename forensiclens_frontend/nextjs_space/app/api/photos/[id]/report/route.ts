export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, HeadingLevel, ShadingType,
  TableLayoutType, Header, Footer, PageNumber, NumberFormat,
} from "docx";

function p(text: string, opts?: { bold?: boolean; size?: number; color?: string; alignment?: typeof AlignmentType[keyof typeof AlignmentType]; spacing?: { after?: number; before?: number }; heading?: typeof HeadingLevel[keyof typeof HeadingLevel] }) {
  return new Paragraph({
    alignment: opts?.alignment,
    spacing: opts?.spacing || { after: 120 },
    heading: opts?.heading,
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size || 22,
        color: opts?.color || "333333",
        font: "Calibri",
      }),
    ],
  });
}

function tableRow(label: string, value: string, highlight = false) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: "F0F4F8" },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, color: "2D3748", font: "Calibri" })] })],
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        shading: highlight ? { type: ShadingType.SOLID, color: "FFF5F5" } : undefined,
        children: [new Paragraph({ children: [new TextRun({ text: value || "N/A", size: 20, color: highlight ? "E53E3E" : "4A5568", font: "Calibri", bold: highlight })] })],
      }),
    ],
  });
}

function sectionHeader(text: string) {
  return p(text, { bold: true, size: 28, color: "1A365D", spacing: { before: 300, after: 150 }, heading: HeadingLevel.HEADING_2 });
}

function divider() {
  return new Paragraph({ spacing: { before: 100, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E0" } }, children: [] });
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;

    const photo = await prisma.photo.findFirst({ where: { id: params?.id, userId } });
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const anomalyData = photo.anomalyData as any;
    const metadata = anomalyData?.extracted_metadata || {};
    const metaAnalysis = anomalyData?.metadata_analysis || {};
    const caseNumber = `FL-${photo.id.substring(0, 8).toUpperCase()}-${new Date().getFullYear()}`;
    const reportDate = new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "long" });

    const sections: Paragraph[] = [];

    // Title page
    sections.push(p("", { spacing: { before: 600 } }));
    sections.push(p("FORENSICLENS AI", { bold: true, size: 48, color: "1A365D", alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
    sections.push(p("FORENSIC IMAGE ANALYSIS REPORT", { bold: true, size: 32, color: "2B6CB0", alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
    sections.push(divider());
    sections.push(p(`Case Number: ${caseNumber}`, { size: 24, alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
    sections.push(p(`Report Generated: ${reportDate}`, { size: 20, color: "718096", alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
    sections.push(p(`Analyst: ${(session.user as any)?.name || (session.user as any)?.email || "Unknown"}`, { size: 20, color: "718096", alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
    sections.push(p(`Classification: CONFIDENTIAL`, { bold: true, size: 22, color: "E53E3E", alignment: AlignmentType.CENTER, spacing: { after: 300 } }));
    sections.push(divider());

    // 1. Executive Summary
    sections.push(sectionHeader("1. EXECUTIVE SUMMARY"));
    if (anomalyData) {
      sections.push(p(`Verdict: ${anomalyData.verdict || "Analysis pending"}`, { bold: true, size: 24, color: anomalyData.is_ai_generated || anomalyData.is_manipulated ? "E53E3E" : "38A169" }));
      sections.push(p(`Authenticity Score: ${anomalyData.overall_score != null ? `${Math.round(anomalyData.overall_score * 100)}%` : "N/A"}`, { size: 22 }));
      sections.push(p(`Confidence Level: ${anomalyData.confidence != null ? `${Math.round(anomalyData.confidence * 100)}%` : "N/A"}`, { size: 22 }));
      sections.push(p(`AI Generated: ${anomalyData.is_ai_generated ? "YES" : "NO"}`, { bold: true, color: anomalyData.is_ai_generated ? "E53E3E" : "38A169" }));
      sections.push(p(`Manipulation Detected: ${anomalyData.is_manipulated ? "YES" : "NO"}`, { bold: true, color: anomalyData.is_manipulated ? "E53E3E" : "38A169" }));
      if (anomalyData.ai_generator_likely && anomalyData.ai_generator_likely !== "null") {
        sections.push(p(`Suspected AI Generator: ${anomalyData.ai_generator_likely}`, { bold: true, color: "805AD5" }));
      }
      if (anomalyData.summary) sections.push(p(anomalyData.summary, { spacing: { before: 120, after: 200 } }));
    } else {
      sections.push(p("No forensic analysis has been performed on this image yet.", { color: "718096" }));
    }

    // 2. Image Information
    sections.push(sectionHeader("2. IMAGE INFORMATION"));
    const imageTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        tableRow("File Name", photo.fileName || "Unknown"),
        tableRow("File Size", photo.fileSize ? `${(photo.fileSize / 1024 / 1024).toFixed(2)} MB` : "Unknown"),
        tableRow("MIME Type", photo.mimeType || "Unknown"),
        tableRow("Upload Date", photo.createdAt ? new Date(photo.createdAt).toLocaleString() : "Unknown"),
        tableRow("Analysis Status", photo.anomalyStatus || "PENDING"),
        tableRow("Upscale Status", photo.upscaleStatus || "PENDING"),
        tableRow("Image Dimensions", metadata.image_width && metadata.image_height ? `${metadata.image_width} × ${metadata.image_height}` : "Unknown"),
      ],
    });
    sections.push(new Paragraph({ children: [] }));
    sections.push(imageTable as any);

    // 3. Camera & Device Information
    sections.push(sectionHeader("3. CAMERA & DEVICE INFORMATION"));
    const cameraTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        tableRow("Camera Make", metadata.camera_make || "Not found", !metadata.camera_make),
        tableRow("Camera Model", metadata.camera_model || "Not found", !metadata.camera_model),
        tableRow("Lens", metadata.lens || "Not found"),
        tableRow("Focal Length", metadata.focal_length || "Not found"),
        tableRow("Aperture", metadata.aperture || "Not found"),
        tableRow("Shutter Speed", metadata.shutter_speed ? String(metadata.shutter_speed) : "Not found"),
        tableRow("ISO", metadata.iso ? String(metadata.iso) : "Not found"),
        tableRow("Flash", metadata.flash ? String(metadata.flash) : "Not found"),
      ],
    });
    sections.push(new Paragraph({ children: [] }));
    sections.push(cameraTable as any);
    if (!metadata.camera_make && !metadata.camera_model) {
      sections.push(p("- WARNING: No camera information found. This is a strong indicator of AI-generated or heavily manipulated content.", { bold: true, color: "E53E3E", spacing: { before: 100 } }));
    }

    // 4. Geolocation Data
    sections.push(sectionHeader("4. GEOLOCATION DATA"));
    if (metadata.gps_latitude && metadata.gps_longitude) {
      const geoTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          tableRow("Latitude", String(metadata.gps_latitude)),
          tableRow("Longitude", String(metadata.gps_longitude)),
          tableRow("Altitude", metadata.gps_altitude ? `${metadata.gps_altitude}m` : "Not available"),
          tableRow("Map Link", `https://www.google.com/maps?q=${metadata.gps_latitude},${metadata.gps_longitude}`),
        ],
      });
      sections.push(new Paragraph({ children: [] }));
      sections.push(geoTable as any);
    } else {
      sections.push(p("No GPS/geolocation data found embedded in this image.", { color: "718096" }));
    }

    // 5. Temporal Analysis
    sections.push(sectionHeader("5. TEMPORAL ANALYSIS (TIMESTAMPS)"));
    const timeTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        tableRow("Date Original", metadata.date_original ? new Date(metadata.date_original).toLocaleString() : "Not found", !metadata.date_original),
        tableRow("Date Modified", metadata.date_modified ? new Date(metadata.date_modified).toLocaleString() : "Not found", metadata.time_mismatch),
        tableRow("Date Digitized", metadata.date_digitized ? new Date(metadata.date_digitized).toLocaleString() : "Not found"),
        tableRow("Time Mismatch Detected", metadata.time_mismatch ? "YES — SUSPICIOUS" : "No", metadata.time_mismatch),
      ],
    });
    sections.push(new Paragraph({ children: [] }));
    sections.push(timeTable as any);
    if (metadata.time_mismatch) {
      sections.push(p("- ALERT: Significant discrepancy between original creation and modification timestamps. This indicates the image has been edited after its initial capture.", { bold: true, color: "E53E3E", spacing: { before: 100 } }));
    }

    // 6. Software & Editing Analysis
    sections.push(sectionHeader("6. SOFTWARE & EDITING ANALYSIS"));
    const swTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      rows: [
        tableRow("Editing Software", metadata.editing_software || "None detected", !!metadata.editing_software),
        tableRow("Creator/Artist", metadata.creator || "Not found"),
        tableRow("Copyright", metadata.copyright || "Not found"),
        tableRow("Description", metadata.description || "Not found"),
        tableRow("Color Space", metadata.color_space ? String(metadata.color_space) : "Not found"),
        tableRow("Multiple Saves", metadata.has_multiple_saves ? "YES — SUSPICIOUS" : "No", metadata.has_multiple_saves),
        tableRow("EXIF Field Count", metadata.metadata_field_count != null ? String(metadata.metadata_field_count) : "Unknown", metadata.metadata_field_count < 5),
      ],
    });
    sections.push(new Paragraph({ children: [] }));
    sections.push(swTable as any);

    // 7. AI Metadata Forensics
    if (metaAnalysis && Object.keys(metaAnalysis).length > 0) {
      sections.push(sectionHeader("7. METADATA FORENSIC ASSESSMENT"));
      const metaForensicTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        rows: [
          tableRow("Editing Detected", metaAnalysis.editing_detected ? "YES" : "NO", metaAnalysis.editing_detected),
          tableRow("Software Used", metaAnalysis.software_used || "None"),
          tableRow("Timestamp Anomaly", metaAnalysis.timestamp_anomaly ? "YES" : "NO", metaAnalysis.timestamp_anomaly),
          tableRow("Metadata Stripped", metaAnalysis.metadata_stripped ? "YES — SUSPICIOUS" : "NO", metaAnalysis.metadata_stripped),
          tableRow("GPS Consistent", metaAnalysis.gps_consistent == null ? "N/A" : metaAnalysis.gps_consistent ? "YES" : "NO", metaAnalysis.gps_consistent === false),
          tableRow("Camera Authentic", metaAnalysis.camera_authentic == null ? "N/A" : metaAnalysis.camera_authentic ? "YES" : "NO", metaAnalysis.camera_authentic === false),
          tableRow("Multiple Saves", metaAnalysis.multiple_saves ? "YES" : "NO", metaAnalysis.multiple_saves),
          tableRow("AI Markers Found", metaAnalysis.ai_markers_found ? "YES — CRITICAL" : "NO", metaAnalysis.ai_markers_found),
        ],
      });
      sections.push(new Paragraph({ children: [] }));
      sections.push(metaForensicTable as any);
      if (metaAnalysis.details) {
        sections.push(p("Assessment Details:", { bold: true, spacing: { before: 150 } }));
        sections.push(p(metaAnalysis.details, { color: "4A5568" }));
      }
    }

    // 8. Detailed Forensic Findings
    const findings = anomalyData?.findings || [];
    if (findings.length > 0) {
      sections.push(sectionHeader(`${metaAnalysis && Object.keys(metaAnalysis).length > 0 ? "8" : "7"}. DETAILED FORENSIC FINDINGS`));
      findings.forEach((f: any, i: number) => {
        const sevColor = f.severity === "critical" ? "E53E3E" : f.severity === "high" ? "DD6B20" : f.severity === "medium" ? "D69E2E" : "4A5568";
        sections.push(p(`Finding ${i + 1}: ${(f.type || "").replace(/_/g, " ").toUpperCase()}`, { bold: true, size: 24, color: "2D3748", spacing: { before: 200 } }));
        const findingTable = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          rows: [
            tableRow("Analysis Type", (f.type || "").replace(/_/g, " ").toUpperCase()),
            tableRow("Severity", (f.severity || "none").toUpperCase(), f.severity === "critical" || f.severity === "high"),
            tableRow("Confidence", f.confidence != null ? `${Math.round(f.confidence * 100)}%` : "N/A"),
            tableRow("Anomaly Detected", f.anomaly_detected ? "YES" : "NO", f.anomaly_detected),
          ],
        });
        sections.push(findingTable as any);
        if (f.description) sections.push(p(f.description, { color: "4A5568", spacing: { before: 80 } }));
      });
    }

    // Footer disclaimer
    sections.push(divider());
    sections.push(p("", { spacing: { before: 300 } }));
    sections.push(p("DISCLAIMER", { bold: true, size: 20, color: "718096" }));
    sections.push(p("This report was generated by ForensicLens AI automated forensic analysis system. Results should be verified by a qualified forensic analyst before being used as evidence. AI-based analysis provides probabilistic assessments and should not be considered definitive proof of authenticity or manipulation.", { size: 18, color: "A0AEC0" }));
    sections.push(p(`Report ID: ${caseNumber} | Generated by ForensicLens AI v1.0`, { size: 16, color: "CBD5E0", alignment: AlignmentType.CENTER, spacing: { before: 200 } }));

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1200, right: 1200 },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [p(`ForensicLens AI — Case ${caseNumber}`, { size: 16, color: "A0AEC0" })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "CONFIDENTIAL — ", size: 16, color: "E53E3E", font: "Calibri" }),
                  new TextRun({ text: "Page ", size: 16, color: "A0AEC0", font: "Calibri" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "A0AEC0", font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="ForensicLens_Report_${caseNumber}.docx"`,
      },
    });
  } catch (err: any) {
    console.error("Report generation error:", err);
    return NextResponse.json({ error: "Failed to generate report: " + (err?.message || "Unknown") }, { status: 500 });
  }
}
