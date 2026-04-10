export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;
    const body = await request.json();
    const { action, resultUrl, resultData, backendPhotoId } = body ?? {};

    const photo = await prisma.photo.findFirst({ where: { id: params?.id, userId } });
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    const updateData: any = {};
    if (backendPhotoId) updateData.backendPhotoId = backendPhotoId;

    if (action === "anomaly_start") {
      updateData.anomalyStatus = "PROCESSING";
      updateData.status = "PROCESSING";
    } else if (action === "anomaly_complete") {
      updateData.anomalyStatus = "COMPLETED";
      updateData.anomalyUrl = resultUrl ?? null;
      updateData.anomalyData = resultData ?? null;
      if (photo?.upscaleStatus !== "PROCESSING") updateData.status = "COMPLETED";
    } else if (action === "anomaly_fail") {
      updateData.anomalyStatus = "FAILED";
      if (photo?.upscaleStatus !== "PROCESSING") updateData.status = "FAILED";
    } else if (action === "upscale_start") {
      updateData.upscaleStatus = "PROCESSING";
      updateData.status = "PROCESSING";
    } else if (action === "upscale_complete") {
      updateData.upscaleStatus = "COMPLETED";
      updateData.upscaledUrl = resultUrl ?? null;
      updateData.upscaleData = resultData ?? null;
      if (photo?.anomalyStatus !== "PROCESSING") updateData.status = "COMPLETED";
    } else if (action === "upscale_fail") {
      updateData.upscaleStatus = "FAILED";
      if (photo?.anomalyStatus !== "PROCESSING") updateData.status = "FAILED";
    }

    const updated = await prisma.photo.update({ where: { id: params?.id }, data: updateData });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Process update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
