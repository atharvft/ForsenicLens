export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import exifr from "exifr";

interface MetadataResult {
  camera: {
    make: string | null;
    model: string | null;
    lens: string | null;
    focalLength: string | null;
    aperture: string | null;
    shutterSpeed: string | null;
    iso: number | null;
    flash: string | null;
    whiteBalance: string | null;
    exposureMode: string | null;
    meteringMode: string | null;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
    city: string | null;
    country: string | null;
    mapUrl: string | null;
  };
  datetime: {
    dateOriginal: string | null;
    dateModified: string | null;
    dateDigitized: string | null;
    timezone: string | null;
    timeMismatch: boolean;
  };
  software: {
    editingSoftware: string | null;
    creator: string | null;
    copyright: string | null;
    description: string | null;
    profileDescription: string | null;
    colorSpace: string | null;
  };
  image: {
    width: number | null;
    height: number | null;
    bitDepth: number | null;
    colorType: string | null;
    compression: string | null;
    orientation: number | null;
    xResolution: number | null;
    yResolution: number | null;
    resolutionUnit: string | null;
  };
  flags: {
    hasGPS: boolean;
    hasEditingSoftware: boolean;
    hasTimeMismatch: boolean;
    hasMultipleSaves: boolean;
    strippedMetadata: boolean;
    suspiciousFlags: string[];
  };
  raw: Record<string, any>;
}

function formatExposure(val: any): string | null {
  if (val == null) return null;
  if (typeof val === "number") {
    if (val < 1) return `1/${Math.round(1 / val)}s`;
    return `${val}s`;
  }
  return String(val);
}

function formatDate(val: any): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toISOString();
  } catch {
    return String(val);
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;

    const photo = await prisma.photo.findFirst({ where: { id: params?.id, userId } });
    if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    let imageUrl = photo.originalUrl;
    if (!imageUrl && photo.originalCloudPath) {
      imageUrl = await getFileUrl(photo.originalCloudPath, photo.isOriginalPublic);
    }
    if (!imageUrl) return NextResponse.json({ error: "No image available" }, { status: 400 });

    // Fetch the image buffer
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());

    // Extract ALL EXIF data
    let rawExif: any = {};
    let gpsData: any = null;
    let iccData: any = null;

    try {
      rawExif = await exifr.parse(imgBuffer, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        ihdr: true,
        exif: true,
        gps: true,
        interop: true,
        makerNote: false,
        userComment: true,
        translateKeys: true,
        translateValues: true,
        reviveValues: true,
        mergeOutput: true,
      }) || {};
    } catch (e) {
      console.log("EXIF parse warning:", e);
    }

    try {
      gpsData = await exifr.gps(imgBuffer).catch(() => null);
    } catch { /* no gps */ }

    // Extract dates
    const dateOriginal = formatDate(rawExif?.DateTimeOriginal || rawExif?.CreateDate);
    const dateModified = formatDate(rawExif?.ModifyDate || rawExif?.DateTime);
    const dateDigitized = formatDate(rawExif?.DateTimeDigitized);

    // Detect time mismatches
    let timeMismatch = false;
    if (dateOriginal && dateModified) {
      const origMs = new Date(dateOriginal).getTime();
      const modMs = new Date(dateModified).getTime();
      if (!isNaN(origMs) && !isNaN(modMs)) {
        timeMismatch = Math.abs(origMs - modMs) > 60000;
      }
    }

    // Detect suspicious flags
    const suspiciousFlags: string[] = [];
    const editingSw = rawExif?.Software || rawExif?.CreatorTool || rawExif?.ProcessingSoftware || null;

    if (editingSw) {
      const sw = String(editingSw).toLowerCase();
      if (sw.includes("photoshop")) suspiciousFlags.push("Edited with Adobe Photoshop");
      else if (sw.includes("lightroom")) suspiciousFlags.push("Processed with Adobe Lightroom");
      else if (sw.includes("gimp")) suspiciousFlags.push("Edited with GIMP");
      else if (sw.includes("canva")) suspiciousFlags.push("Created/Edited with Canva");
      else if (sw.includes("snapseed")) suspiciousFlags.push("Edited with Snapseed");
      else if (sw.includes("affinity")) suspiciousFlags.push("Edited with Affinity Photo");
      else if (sw.includes("pixlr")) suspiciousFlags.push("Edited with Pixlr");
      else if (sw.includes("paint")) suspiciousFlags.push("Edited with Paint/Paint.NET");
      else suspiciousFlags.push(`Processed with: ${editingSw}`);
    }

    if (timeMismatch) suspiciousFlags.push("Original and modified timestamps differ");

    const hasMultipleSaves = !!(rawExif?.HistorySoftwareAgent || rawExif?.DerivedFromDocumentID);
    if (hasMultipleSaves) suspiciousFlags.push("Image has been saved multiple times");

    if (rawExif?.DigitalSourceType) {
      const dst = String(rawExif.DigitalSourceType).toLowerCase();
      if (dst.includes("composite")) suspiciousFlags.push("Image marked as composite");
      if (dst.includes("generated") || dst.includes("ai")) suspiciousFlags.push("Image marked as digitally generated");
    }

    const strippedMetadata = Object.keys(rawExif).length < 5;
    if (strippedMetadata) suspiciousFlags.push("Metadata appears stripped or minimal - possible tampering");

    // Check for AI generation markers
    if (rawExif?.ImageDescription) {
      const desc = String(rawExif.ImageDescription).toLowerCase();
      if (desc.includes("midjourney") || desc.includes("dall-e") || desc.includes("stable diffusion") || desc.includes("ai generated")) {
        suspiciousFlags.push("AI generation marker found in metadata");
      }
    }

    // Build result
    const result: MetadataResult = {
      camera: {
        make: rawExif?.Make || null,
        model: rawExif?.Model || null,
        lens: rawExif?.LensModel || rawExif?.Lens || null,
        focalLength: rawExif?.FocalLength ? `${rawExif.FocalLength}mm` : null,
        aperture: rawExif?.FNumber ? `f/${rawExif.FNumber}` : null,
        shutterSpeed: formatExposure(rawExif?.ExposureTime),
        iso: rawExif?.ISO || null,
        flash: rawExif?.Flash || null,
        whiteBalance: rawExif?.WhiteBalance || null,
        exposureMode: rawExif?.ExposureMode || null,
        meteringMode: rawExif?.MeteringMode || null,
      },
      location: {
        latitude: gpsData?.latitude || rawExif?.latitude || null,
        longitude: gpsData?.longitude || rawExif?.longitude || null,
        altitude: rawExif?.GPSAltitude || null,
        city: rawExif?.City || rawExif?.LocationName || null,
        country: rawExif?.Country || rawExif?.CountryCode || null,
        mapUrl: gpsData?.latitude && gpsData?.longitude
          ? `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`
          : null,
      },
      datetime: {
        dateOriginal,
        dateModified,
        dateDigitized,
        timezone: rawExif?.OffsetTimeOriginal || rawExif?.OffsetTime || null,
        timeMismatch,
      },
      software: {
        editingSoftware: editingSw ? String(editingSw) : null,
        creator: rawExif?.Creator || rawExif?.Artist || rawExif?.Author || null,
        copyright: rawExif?.Copyright || null,
        description: rawExif?.ImageDescription || rawExif?.Description || null,
        profileDescription: rawExif?.ProfileDescription || rawExif?.ICCProfileName || null,
        colorSpace: rawExif?.ColorSpace || rawExif?.ColorSpaceData || null,
      },
      image: {
        width: rawExif?.ImageWidth || rawExif?.ExifImageWidth || rawExif?.PixelXDimension || null,
        height: rawExif?.ImageHeight || rawExif?.ExifImageHeight || rawExif?.PixelYDimension || null,
        bitDepth: rawExif?.BitsPerSample || rawExif?.BitDepth || null,
        colorType: rawExif?.PhotometricInterpretation || null,
        compression: rawExif?.Compression || null,
        orientation: rawExif?.Orientation || null,
        xResolution: rawExif?.XResolution || null,
        yResolution: rawExif?.YResolution || null,
        resolutionUnit: rawExif?.ResolutionUnit || null,
      },
      flags: {
        hasGPS: !!(gpsData?.latitude || rawExif?.latitude),
        hasEditingSoftware: !!editingSw,
        hasTimeMismatch: timeMismatch,
        hasMultipleSaves,
        strippedMetadata,
        suspiciousFlags,
      },
      raw: rawExif,
    };

    return NextResponse.json({ success: true, metadata: result });
  } catch (err: any) {
    console.error("Metadata extraction error:", err);
    return NextResponse.json({ error: "Failed to extract metadata" }, { status: 500 });
  }
}
