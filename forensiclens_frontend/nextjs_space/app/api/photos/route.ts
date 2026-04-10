export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams?.get("search") ?? "";
    const statusFilter = searchParams?.get("status") ?? "";
    const page = parseInt(searchParams?.get("page") ?? "1");
    const limit = parseInt(searchParams?.get("limit") ?? "20");

    const where: any = { userId };
    if (search) where.fileName = { contains: search, mode: "insensitive" };
    if (statusFilter && statusFilter !== "ALL") where.status = statusFilter;

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.photo.count({ where }),
    ]);

    return NextResponse.json({ photos, total, page, limit });
  } catch (err: any) {
    console.error("Photos list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
