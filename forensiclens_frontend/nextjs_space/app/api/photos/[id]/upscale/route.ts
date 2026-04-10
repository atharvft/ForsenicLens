export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl, generatePresignedUploadUrl } from "@/lib/s3";
import { realUpscaleImage } from "@/lib/forensic-engine";

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

    // Parse scale factor from request (default 2x)
    let scaleFactor = 2;
    try {
      const body = await request.json().catch(() => ({}));
      if (body?.scale_factor && body.scale_factor >= 1.5 && body.scale_factor <= 4) {
        scaleFactor = body.scale_factor;
      }
    } catch {}

    // Mark as processing
    await prisma.photo.update({
      where: { id: params.id },
      data: { upscaleStatus: "PROCESSING", status: "PROCESSING" },
    });

    // Get the image URL and fetch buffer
    let imageUrl = photo.originalUrl;
    if (!imageUrl && photo.originalCloudPath) {
      imageUrl = await getFileUrl(photo.originalCloudPath, photo.isOriginalPublic);
    }

    let imgBuffer: Buffer;
    try {
      const imgResp = await fetch(imageUrl!);
      if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
      imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    } catch (fetchErr: any) {
      console.error("Image fetch error:", fetchErr);
      await prisma.photo.update({
        where: { id: params.id },
        data: { upscaleStatus: "FAILED", status: "FAILED" },
      });
      return NextResponse.json({ error: "Failed to fetch image for upscaling" }, { status: 500 });
    }

    // ============================================================
    // REAL UPSCALING with Sharp Lanczos3
    // ============================================================
    console.log(`[Upscale] Starting real ${scaleFactor}x upscale for photo ${params.id}...`);
    let upscaledBuffer: Buffer;
    let upscaleMetadata: any;
    try {
      const result = await realUpscaleImage(imgBuffer, scaleFactor);
      upscaledBuffer = result.upscaledBuffer;
      upscaleMetadata = result.metadata;
      console.log(`[Upscale] Complete: ${upscaleMetadata.original_width}x${upscaleMetadata.original_height} -> ${upscaleMetadata.upscaled_width}x${upscaleMetadata.upscaled_height}`);
    } catch (upscaleErr: any) {
      console.error("Real upscale error:", upscaleErr);
      await prisma.photo.update({
        where: { id: params.id },
        data: { upscaleStatus: "FAILED", status: "FAILED" },
      });
      return NextResponse.json({ error: "Image upscaling failed: " + upscaleErr.message }, { status: 500 });
    }

    // Upload the upscaled image to S3
    let upscaledUrl: string | null = null;
    let upscaledCloudPath: string | null = null;

    try {
      const ext = "png";
      const upscaleFileName = `upscaled_${scaleFactor}x_${photo.fileName?.replace(/\.[^.]+$/, "") ?? "photo"}.${ext}`;

      const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
        upscaleFileName,
        "image/png",
        true
      );

      // Check if content-disposition is in signed headers
      const signedHeadersMatch = uploadUrl.match(/X-Amz-SignedHeaders=([^&]+)/);
      const signedHeaders = signedHeadersMatch ? decodeURIComponent(signedHeadersMatch[1]) : "";
      const needsContentDisposition = signedHeaders.includes("content-disposition");

      const uploadHeaders: Record<string, string> = {
        "Content-Type": "image/png",
      };
      if (needsContentDisposition) {
        uploadHeaders["Content-Disposition"] = "attachment";
      }

      const uploadResp = await fetch(uploadUrl, {
        method: "PUT",
        headers: uploadHeaders,
        body: upscaledBuffer,
      });

      if (uploadResp.ok) {
        upscaledCloudPath = cloud_storage_path;
        upscaledUrl = await getFileUrl(cloud_storage_path, true);
      } else {
        console.error("S3 upload failed:", uploadResp.status, await uploadResp.text());
        // Fall back to base64 data URL
        upscaledUrl = `data:image/png;base64,${upscaledBuffer.toString("base64")}`;
      }
    } catch (s3Err: any) {
      console.error("S3 upload error:", s3Err);
      upscaledUrl = `data:image/png;base64,${upscaledBuffer.toString("base64")}`;
    }

    // Update photo with real upscale result
    const updatedPhoto = await prisma.photo.update({
      where: { id: params.id },
      data: {
        upscaleStatus: "COMPLETED",
        upscaledUrl: upscaledUrl,
        upscaledCloudPath: upscaledCloudPath,
        isUpscaledPublic: true,
        upscaleData: {
          ...upscaleMetadata,
          engine: "ForensicLens Sharp Engine v2.0",
          forensically_sound: true,
          note: "Real pixel-level upscaling using Lanczos3 resampling with adaptive sharpening. Original content is preserved — no AI regeneration.",
        },
        status: photo.anomalyStatus === "PROCESSING" ? "PROCESSING" : "COMPLETED",
      },
    });

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
      upscale_details: upscaleMetadata,
    });
  } catch (err: any) {
    console.error("Upscale route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
