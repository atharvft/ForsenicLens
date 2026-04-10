export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { photoId, cloud_storage_path } = body ?? {};
    if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

    const url = await getFileUrl(cloud_storage_path, true);
    const photo = await prisma.photo.update({
      where: { id: photoId },
      data: { originalUrl: url, originalCloudPath: cloud_storage_path, isOriginalPublic: true },
    });

    return NextResponse.json(photo);
  } catch (err: any) {
    console.error("Upload complete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
