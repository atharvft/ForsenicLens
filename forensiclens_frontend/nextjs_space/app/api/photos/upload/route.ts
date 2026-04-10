export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { generatePresignedUploadUrl } from "@/lib/s3";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { fileName, contentType, fileSize } = body ?? {};
    if (!fileName || !contentType) return NextResponse.json({ error: "fileName and contentType required" }, { status: 400 });

    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(fileName, contentType, true);

    const photo = await prisma.photo.create({
      data: {
        userId,
        fileName,
        fileSize: fileSize ?? 0,
        mimeType: contentType,
        originalCloudPath: cloud_storage_path,
        isOriginalPublic: true,
        status: "UPLOADED",
      },
    });

    return NextResponse.json({ uploadUrl, cloud_storage_path, photoId: photo?.id });
  } catch (err: any) {
    console.error("Upload presign error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
