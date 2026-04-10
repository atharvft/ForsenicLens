export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { runForensicAnalysis, type ForensicReport } from "@/lib/forensic-engine";
import exifr from "exifr";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;

    const photo = await prisma.photo.findFirst({ where: { id: params?.id, userId } });
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    if (!photo.originalCloudPath && !photo.originalUrl) {
      return NextResponse.json({ error: "No original image available" }, { status: 400 });
    }

    // Mark as processing
    await prisma.photo.update({
      where: { id: params.id },
      data: { anomalyStatus: "PROCESSING", status: "PROCESSING" },
    });

    // Get the image URL and fetch buffer
    let imageUrl = photo.originalUrl;
    if (!imageUrl && photo.originalCloudPath) {
      imageUrl = await getFileUrl(photo.originalCloudPath, photo.isOriginalPublic);
    }

    let imgBuffer: Buffer;
    let base64Image: string;
    try {
      const imgResp = await fetch(imageUrl!);
      if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
      imgBuffer = Buffer.from(await imgResp.arrayBuffer());
      const mimeType = photo.mimeType || "image/jpeg";
      base64Image = `data:${mimeType};base64,${imgBuffer.toString("base64")}`;
    } catch (fetchErr: any) {
      console.error("Image fetch error:", fetchErr);
      await prisma.photo.update({
        where: { id: params.id },
        data: { anomalyStatus: "FAILED", status: "FAILED" },
      });
      return NextResponse.json({ error: "Failed to fetch image for analysis" }, { status: 500 });
    }

    // ============================================================
    // STEP 1: Extract EXIF metadata (needed by forensic engine)
    // ============================================================
    let extractedMetadata: any = {};
    let metadataSummary = "No EXIF metadata found (metadata may have been stripped).";
    let hasExifMetadata = false;
    let exifFieldCount = 0;
    let hasCameraInfo = false;
    try {
      const rawExif = await exifr.parse(imgBuffer, {
        tiff: true, xmp: true, icc: true, iptc: true, jfif: true,
        exif: true, gps: true, translateKeys: true, translateValues: true,
        reviveValues: true, mergeOutput: true,
      }) || {};
      const gpsData = await exifr.gps(imgBuffer).catch(() => null);

      const editingSw = rawExif?.Software || rawExif?.CreatorTool || rawExif?.ProcessingSoftware || null;
      const dateOriginal = rawExif?.DateTimeOriginal || rawExif?.CreateDate || null;
      const dateModified = rawExif?.ModifyDate || rawExif?.DateTime || null;
      let timeMismatch = false;
      if (dateOriginal && dateModified) {
        const origMs = new Date(dateOriginal).getTime();
        const modMs = new Date(dateModified).getTime();
        if (!isNaN(origMs) && !isNaN(modMs)) timeMismatch = Math.abs(origMs - modMs) > 60000;
      }

      extractedMetadata = {
        camera_make: rawExif?.Make || null,
        camera_model: rawExif?.Model || null,
        lens: rawExif?.LensModel || rawExif?.Lens || null,
        focal_length: rawExif?.FocalLength ? `${rawExif.FocalLength}mm` : null,
        aperture: rawExif?.FNumber ? `f/${rawExif.FNumber}` : null,
        iso: rawExif?.ISO || null,
        shutter_speed: rawExif?.ExposureTime || null,
        flash: rawExif?.Flash || null,
        editing_software: editingSw ? String(editingSw) : null,
        creator: rawExif?.Creator || rawExif?.Artist || rawExif?.Author || null,
        copyright: rawExif?.Copyright || null,
        date_original: dateOriginal ? new Date(dateOriginal).toISOString() : null,
        date_modified: dateModified ? new Date(dateModified).toISOString() : null,
        time_mismatch: timeMismatch,
        gps_latitude: gpsData?.latitude || rawExif?.latitude || null,
        gps_longitude: gpsData?.longitude || rawExif?.longitude || null,
        image_width: rawExif?.ImageWidth || rawExif?.ExifImageWidth || null,
        image_height: rawExif?.ImageHeight || rawExif?.ExifImageHeight || null,
        has_multiple_saves: !!(rawExif?.HistorySoftwareAgent || rawExif?.DerivedFromDocumentID),
        digital_source_type: rawExif?.DigitalSourceType || null,
        metadata_field_count: Object.keys(rawExif).length,
      };

      hasExifMetadata = Object.keys(rawExif).length > 0;
      exifFieldCount = Object.keys(rawExif).length;
      hasCameraInfo = !!(rawExif?.Make || rawExif?.Model);

      const parts: string[] = [];
      if (extractedMetadata.camera_make || extractedMetadata.camera_model) parts.push(`Camera: ${[extractedMetadata.camera_make, extractedMetadata.camera_model].filter(Boolean).join(" ")}`);
      if (extractedMetadata.lens) parts.push(`Lens: ${extractedMetadata.lens}`);
      if (extractedMetadata.focal_length) parts.push(`Focal Length: ${extractedMetadata.focal_length}`);
      if (extractedMetadata.aperture) parts.push(`Aperture: ${extractedMetadata.aperture}`);
      if (extractedMetadata.iso) parts.push(`ISO: ${extractedMetadata.iso}`);
      if (extractedMetadata.editing_software) parts.push(`Editing Software: ${extractedMetadata.editing_software}`);
      if (extractedMetadata.date_original) parts.push(`Date Original: ${extractedMetadata.date_original}`);
      if (extractedMetadata.date_modified) parts.push(`Date Modified: ${extractedMetadata.date_modified}`);
      if (timeMismatch) parts.push(`- TIME MISMATCH: Original and Modified dates differ significantly`);
      if (extractedMetadata.gps_latitude && extractedMetadata.gps_longitude) parts.push(`GPS: ${extractedMetadata.gps_latitude}, ${extractedMetadata.gps_longitude}`);
      if (extractedMetadata.has_multiple_saves) parts.push(`- Image has been saved/exported multiple times`);
      if (extractedMetadata.metadata_field_count < 5) parts.push(`- VERY FEW METADATA FIELDS (${extractedMetadata.metadata_field_count}) - metadata may have been stripped`);
      metadataSummary = parts.length > 0 ? parts.join("\n") : "No meaningful EXIF metadata found (metadata may have been stripped - this is suspicious).";
    } catch (exifErr) {
      console.log("EXIF extraction warning:", exifErr);
      metadataSummary = "EXIF extraction failed - metadata may be corrupted or absent.";
    }

    // ============================================================
    // STEP 2: Run forensic analysis (all 6 algorithms incl. AI detection)
    // ============================================================
    let forensicReport: ForensicReport;
    try {
      forensicReport = await runForensicAnalysis(imgBuffer, {
        hasMetadata: hasExifMetadata,
        fieldCount: exifFieldCount,
        hasCameraInfo,
      });
    } catch (forensicErr: any) {
      console.error("Forensic analysis error:", forensicErr);
      await prisma.photo.update({
        where: { id: params.id },
        data: { anomalyStatus: "FAILED", status: "FAILED" },
      });
      return NextResponse.json({ error: "Forensic analysis failed" }, { status: 500 });
    }

    // ============================================================
    // STEP 3: Feed real algorithm results to LLM as interpreter
    // ============================================================
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      // Still save forensic results even without LLM
      const forensicOnly = buildForensicOnlyResult(forensicReport, extractedMetadata);
      await prisma.photo.update({
        where: { id: params.id },
        data: { anomalyStatus: "COMPLETED", anomalyData: JSON.parse(JSON.stringify(forensicOnly)), status: photo.upscaleStatus === "PROCESSING" ? "PROCESSING" : "COMPLETED" },
      });
      return NextResponse.json({ success: true, analysis: forensicOnly });
    }

    // Build the forensic data summary for LLM (without heatmap base64 to save tokens)
    const forensicSummary = `
REAL FORENSIC ALGORITHM RESULTS (these are computed from actual pixel data, not guesses):

1. ERROR LEVEL ANALYSIS (ELA):
   - Mean Error Level: ${forensicReport.ela.mean_error}
   - Max Error Level: ${forensicReport.ela.max_error}
   - Std Deviation: ${forensicReport.ela.std_deviation}
   - Suspicious Pixel Ratio: ${(forensicReport.ela.suspicious_pixel_ratio * 100).toFixed(1)}%
   - Manipulation Likelihood: ${forensicReport.ela.manipulation_likelihood.toUpperCase()}
   - Finding: ${forensicReport.ela.details}

2. NOISE PATTERN ANALYSIS:
   - Global Noise Level: ${forensicReport.noise.global_noise_level}
   - Noise Variance: ${forensicReport.noise.noise_variance}
   - Inconsistency Score: ${(forensicReport.noise.inconsistency_score * 100).toFixed(1)}%
   - Uniform Noise (AI indicator): ${forensicReport.noise.uniform_noise}
   - Suspicious Blocks: ${forensicReport.noise.suspicious_blocks}/64
   - Manipulation Likelihood: ${forensicReport.noise.manipulation_likelihood.toUpperCase()}
   - Finding: ${forensicReport.noise.details}

3. JPEG GHOST / DOUBLE COMPRESSION:
   - Ghost Detected: ${forensicReport.jpeg_ghost.ghost_detected}
   - Double Compression: ${forensicReport.jpeg_ghost.double_compression_evidence}
   - Estimated Original Quality: ${forensicReport.jpeg_ghost.min_difference_quality}
   - Manipulation Likelihood: ${forensicReport.jpeg_ghost.manipulation_likelihood.toUpperCase()}
   - Finding: ${forensicReport.jpeg_ghost.details}

4. HISTOGRAM & CHANNEL ANALYSIS:
   - R-G Channel Correlation: ${forensicReport.histogram.channel_correlation}
   - Dynamic Range: ${forensicReport.histogram.dynamic_range}/255
   - Unnatural Peaks: ${forensicReport.histogram.unnatural_peaks}
   - Manipulation Likelihood: ${forensicReport.histogram.manipulation_likelihood.toUpperCase()}
   - Finding: ${forensicReport.histogram.details}

5. COPY-MOVE DETECTION:
   - Blocks Analyzed: ${forensicReport.copy_move.blocks_analyzed}
   - Similar Block Pairs: ${forensicReport.copy_move.similar_block_pairs}
   - Clone Detected: ${forensicReport.copy_move.clone_detected}
   - Manipulation Likelihood: ${forensicReport.copy_move.manipulation_likelihood.toUpperCase()}
   - Finding: ${forensicReport.copy_move.details}

6. AI GENERATION DETECTION:
   - AI Generation Score: ${forensicReport.ai_generation_score?.toFixed(3) ?? 'N/A'} (0=real, 1=AI-generated)
   - Verdict: ${forensicReport.ai_detection?.verdict ?? 'N/A'}
   - Confidence: ${((forensicReport.ai_detection?.confidence ?? 0) * 100).toFixed(0)}%
   - Key Signals: ${forensicReport.ai_detection ? Object.entries(forensicReport.ai_detection.signals).filter(([k, v]) => typeof v === 'boolean' && v).map(([k]) => k).join(', ') || 'none' : 'N/A'}

OVERALL SCORES:
- Manipulation Score: ${forensicReport.overall_manipulation_score} (0=clean, 1=manipulated)
- Authenticity Score: ${forensicReport.overall_authenticity_score} (0=fake, 1=authentic)
- AI Generation Score: ${forensicReport.ai_generation_score?.toFixed(3) ?? 'N/A'} (0=real, 1=AI-generated)
- Image: ${forensicReport.image_dimensions.width}x${forensicReport.image_dimensions.height}, ${(forensicReport.file_size_bytes / 1024).toFixed(0)}KB
- Analysis Time: ${forensicReport.processing_time_ms}ms
`;

    const systemPrompt = `You are ForensicLens AI, an advanced forensic image analysis interpreter. You have been given REAL forensic algorithm results computed from actual pixel-level analysis. Your job is to INTERPRET these results into a clear forensic report.

IMPORTANT: The algorithm results below are REAL computed data, not estimates. Base your analysis on these numbers.

EXIF METADATA:
${metadataSummary}

${forensicSummary}

Based on BOTH the real algorithm results AND your visual inspection of the image, provide your interpretation.

Respond with raw JSON only:
{
  "overall_score": <float 0.0-1.0 where 1.0 = authentic, based heavily on the algorithm authenticity score of ${forensicReport.overall_authenticity_score}>,
  "verdict": "<one of: 'Image appears authentic', 'Possible manipulation detected', 'Likely AI-generated', 'Manipulation detected', 'AI-generated image detected'>",
  "is_ai_generated": <boolean>,
  "is_manipulated": <boolean>,
  "confidence": <float 0.0-1.0>,
  "ai_generator_likely": "<suspected AI generator or null>",
  "findings": [
    {
      "type": "<analysis type>",
      "confidence": <float>,
      "severity": "<none|low|medium|high|critical>",
      "description": "<interpretation of the algorithm results>",
      "anomaly_detected": <boolean>
    }
  ],
  "metadata_analysis": {
    "editing_detected": <boolean>,
    "software_used": "<name or null>",
    "timestamp_anomaly": <boolean>,
    "metadata_stripped": <boolean>,
    "gps_consistent": <boolean or null>,
    "camera_authentic": <boolean or null>,
    "has_camera_info": <boolean>,
    "provenance_score": <float 0.0-1.0>,
    "details": "<paragraph about metadata>"
  },
  "summary": "<2-3 sentence forensic summary referencing specific algorithm findings>"
}`;

    try {
      const llmResponse = await fetch("https://apps.abacus.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: "Interpret the forensic algorithm results above combined with your visual inspection. The algorithm data is real and computed — use those exact numbers in your report. Focus on what the ELA heatmap, noise patterns, and compression analysis reveal about this image's authenticity." },
                { type: "image_url", image_url: { url: base64Image } },
              ],
            },
          ],
          max_tokens: 4000,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      let llmInterpretation: any = null;
      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        const content = llmData?.choices?.[0]?.message?.content;
        if (content) {
          try {
            llmInterpretation = JSON.parse(content);
          } catch {
            llmInterpretation = { summary: content.substring(0, 500) };
          }
        }
      } else {
        console.error("LLM interpretation failed:", llmResponse.status);
      }

      // Build final result: real algorithms + LLM interpretation + metadata
      const aiDetected = forensicReport.ai_generation_score != null && forensicReport.ai_generation_score > 0.5;
      const finalResult = {
        // Real algorithm data (the core of the analysis)
        forensic_algorithms: {
          ela: { ...forensicReport.ela },
          noise: forensicReport.noise,
          jpeg_ghost: forensicReport.jpeg_ghost,
          histogram: forensicReport.histogram,
          copy_move: forensicReport.copy_move,
        },
        ai_detection: forensicReport.ai_detection ?? null,
        ai_generation_score: forensicReport.ai_generation_score ?? null,
        overall_manipulation_score: forensicReport.overall_manipulation_score,
        overall_authenticity_score: forensicReport.overall_authenticity_score,
        overall_score: llmInterpretation?.overall_score ?? forensicReport.overall_authenticity_score,
        verdict: llmInterpretation?.verdict ?? getVerdictFromScore(forensicReport.overall_authenticity_score, aiDetected),
        is_ai_generated: aiDetected || (llmInterpretation?.is_ai_generated ?? false),
        is_manipulated: llmInterpretation?.is_manipulated ?? (forensicReport.overall_manipulation_score > 0.4),
        confidence: llmInterpretation?.confidence ?? 0.8,
        ai_generator_likely: llmInterpretation?.ai_generator_likely ?? null,
        findings: llmInterpretation?.findings ?? buildFindingsFromReport(forensicReport),
        metadata_analysis: llmInterpretation?.metadata_analysis ?? null,
        extracted_metadata: extractedMetadata,
        summary: llmInterpretation?.summary ?? buildSummaryFromReport(forensicReport),
        image_dimensions: forensicReport.image_dimensions,
        file_size_bytes: forensicReport.file_size_bytes,
        processing_time_ms: forensicReport.processing_time_ms,
        analysis_engine: "ForensicLens Real Algorithm Engine v3.0",
        algorithms_used: [
          "Error Level Analysis (ELA) - JPEG recompression artifact detection",
          "Noise Pattern Analysis - Sensor noise residual extraction",
          "JPEG Ghost Detection - Double compression analysis",
          "Histogram & Channel Analysis - Statistical color distribution",
          "Copy-Move Detection - Block matching for cloned regions",
          "AI Generation Detection - 8-signal synthetic image classifier",
          "EXIF Metadata Extraction - Provenance verification",
          "LLM Vision Interpretation - AI-assisted result interpretation",
        ],
      };

      const updatedPhoto = await prisma.photo.update({
        where: { id: params.id },
        data: {
          anomalyStatus: "COMPLETED",
          anomalyData: JSON.parse(JSON.stringify(finalResult)),
          status: photo.upscaleStatus === "PROCESSING" ? "PROCESSING" : "COMPLETED",
        },
      });

      return NextResponse.json({
        success: true,
        photo: updatedPhoto,
        analysis: finalResult,
      });
    } catch (llmErr: any) {
      console.error("LLM interpretation error (non-fatal):", llmErr);
      // LLM failed but we still have real forensic results
      const forensicOnly = buildForensicOnlyResult(forensicReport, extractedMetadata);
      await prisma.photo.update({
        where: { id: params.id },
        data: { anomalyStatus: "COMPLETED", anomalyData: JSON.parse(JSON.stringify(forensicOnly)), status: photo.upscaleStatus === "PROCESSING" ? "PROCESSING" : "COMPLETED" },
      });
      return NextResponse.json({ success: true, analysis: forensicOnly });
    }
  } catch (err: any) {
    console.error("Analyze route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getVerdictFromScore(score: number, aiDetected?: boolean): string {
  if (aiDetected) return "AI-generated image detected";
  if (score >= 0.8) return "Image appears authentic";
  if (score >= 0.6) return "Possible manipulation detected";
  if (score >= 0.4) return "Likely AI-generated";
  if (score >= 0.2) return "Manipulation detected";
  return "AI-generated image detected";
}

function buildFindingsFromReport(report: ForensicReport): any[] {
  const findings = [
    { type: "error_level_analysis", confidence: 0.9, severity: report.ela.manipulation_likelihood, description: report.ela.details, anomaly_detected: report.ela.manipulation_likelihood !== "none" },
    { type: "noise_analysis", confidence: 0.85, severity: report.noise.manipulation_likelihood, description: report.noise.details, anomaly_detected: report.noise.manipulation_likelihood !== "none" },
    { type: "jpeg_ghost_detection", confidence: 0.85, severity: report.jpeg_ghost.manipulation_likelihood, description: report.jpeg_ghost.details, anomaly_detected: report.jpeg_ghost.ghost_detected },
    { type: "histogram_analysis", confidence: 0.8, severity: report.histogram.manipulation_likelihood, description: report.histogram.details, anomaly_detected: report.histogram.manipulation_likelihood !== "none" },
    { type: "clone_detection", confidence: 0.8, severity: report.copy_move.manipulation_likelihood, description: report.copy_move.details, anomaly_detected: report.copy_move.clone_detected },
  ];
  if (report.ai_detection) {
    const aiDet = report.ai_detection;
    const detectedSignals = Object.entries(aiDet.signals).filter(([k, v]) => typeof v === "boolean" && v).map(([k]) => k).join(", ");
    findings.push({
      type: "ai_generation_detection",
      confidence: aiDet.confidence,
      severity: aiDet.verdict === "ai_generated" ? "critical" : aiDet.verdict === "likely_ai_generated" ? "high" : aiDet.verdict === "uncertain" ? "medium" : "none",
      description: `AI Generation Score: ${aiDet.ai_probability.toFixed(3)}. ${aiDet.verdict} (${(aiDet.confidence * 100).toFixed(0)}% confidence). Detected signals: ${detectedSignals || 'none'}. ${aiDet.details}`,
      anomaly_detected: aiDet.ai_probability > 0.5,
    });
  }
  return findings;
}

function buildSummaryFromReport(report: ForensicReport): string {
  const parts: string[] = [];
  if (report.ai_detection && report.ai_detection.ai_probability > 0.5) {
    parts.push(`AI Generation Detection classified this image as "${report.ai_detection.verdict}" with ${(report.ai_detection.confidence * 100).toFixed(0)}% confidence (score: ${report.ai_detection.ai_probability.toFixed(3)}).`);
  }
  if (report.overall_authenticity_score > 0.7 && !(report.ai_detection && report.ai_detection.ai_probability > 0.5)) {
    parts.push(`Forensic analysis indicates the image is likely authentic (score: ${report.overall_authenticity_score}).`);
  } else if (report.overall_authenticity_score > 0.4) {
    parts.push(`Forensic analysis detected potential manipulation (authenticity score: ${report.overall_authenticity_score}).`);
  } else {
    parts.push(`Forensic analysis indicates significant manipulation or AI generation (authenticity score: ${report.overall_authenticity_score}).`);
  }
  if (report.ela.manipulation_likelihood !== "none") parts.push(`ELA detected ${report.ela.manipulation_likelihood} level artifacts.`);
  if (report.noise.uniform_noise) parts.push("Noise patterns are unusually uniform, consistent with AI generation.");
  if (report.jpeg_ghost.double_compression_evidence) parts.push("Double compression detected, indicating post-capture editing.");
  return parts.join(" ");
}

function buildForensicOnlyResult(report: ForensicReport, metadata: any) {
  const aiDetected = report.ai_generation_score != null && report.ai_generation_score > 0.5;
  return {
    forensic_algorithms: {
      ela: { ...report.ela },
      noise: report.noise,
      jpeg_ghost: report.jpeg_ghost,
      histogram: report.histogram,
      copy_move: report.copy_move,
    },
    ai_detection: report.ai_detection ?? null,
    ai_generation_score: report.ai_generation_score ?? null,
    overall_manipulation_score: report.overall_manipulation_score,
    overall_authenticity_score: report.overall_authenticity_score,
    overall_score: report.overall_authenticity_score,
    verdict: getVerdictFromScore(report.overall_authenticity_score, aiDetected),
    is_ai_generated: aiDetected,
    is_manipulated: report.overall_manipulation_score > 0.4,
    confidence: 0.85,
    findings: buildFindingsFromReport(report),
    extracted_metadata: metadata,
    summary: buildSummaryFromReport(report),
    image_dimensions: report.image_dimensions,
    processing_time_ms: report.processing_time_ms,
    analysis_engine: "ForensicLens Real Algorithm Engine v3.0",
    algorithms_used: [
      "Error Level Analysis (ELA)",
      "Noise Pattern Analysis",
      "JPEG Ghost Detection",
      "Histogram & Channel Analysis",
      "Copy-Move Detection",
      "AI Generation Detection",
      "EXIF Metadata Extraction",
    ],
  };
}
