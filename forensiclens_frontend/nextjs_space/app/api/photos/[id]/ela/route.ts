export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { runForensicAnalysis } from "@/lib/forensic-engine";

// Returns the ELA heatmap image for a photo
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;

    const photo = await prisma.photo.findFirst({ where: { id: params?.id, userId } });
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    // Check if we already have ELA data cached in anomalyData
    const anomalyData = photo.anomalyData as any;
    if (anomalyData?.forensic_algorithms?.ela?.heatmap_base64) {
      return NextResponse.json({
        heatmap: anomalyData.forensic_algorithms.ela.heatmap_base64,
      });
    }

    // Generate ELA on the fly
    let imageUrl = photo.originalUrl;
    if (!imageUrl && photo.originalCloudPath) {
      imageUrl = await getFileUrl(photo.originalCloudPath, photo.isOriginalPublic);
    }
    if (!imageUrl) return NextResponse.json({ error: "No image available" }, { status: 400 });

    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());

    const report = await runForensicAnalysis(imgBuffer, { hasMetadata: false, fieldCount: 0, hasCameraInfo: false });
    return NextResponse.json({
      heatmap: report.ela.heatmap_base64,
      ela_data: {
        mean_error: report.ela.mean_error,
        max_error: report.ela.max_error,
        suspicious_pixel_ratio: report.ela.suspicious_pixel_ratio,
        manipulation_likelihood: report.ela.manipulation_likelihood,
      },
    });
  } catch (err: any) {
    console.error("ELA route error:", err);
    return NextResponse.json({ error: "Failed to generate ELA" }, { status: 500 });
  }
}
