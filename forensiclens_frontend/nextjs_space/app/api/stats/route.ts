export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [totalPhotos, anomaliesDetected, photosUpscaled, processingCount] = await Promise.all([
      prisma.photo.count({ where: { userId } }),
      prisma.photo.count({ where: { userId, anomalyStatus: "COMPLETED" } }),
      prisma.photo.count({ where: { userId, upscaleStatus: "COMPLETED" } }),
      prisma.photo.count({ where: { userId, status: "PROCESSING" } }),
    ]);

    return NextResponse.json({ totalPhotos, anomaliesDetected, photosUpscaled, processingCount });
  } catch (err: any) {
    console.error("Stats error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
