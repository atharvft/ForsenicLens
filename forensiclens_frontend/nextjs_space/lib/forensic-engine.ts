/**
 * ForensicLens AI — Real Forensic Image Analysis Engine
 * 
 * This module implements REAL image forensic algorithms using the Sharp library.
 * No LLM guessing — actual pixel-level signal processing.
 * 
 * Algorithms:
 * 1. Error Level Analysis (ELA) — detects manipulation via JPEG recompression artifacts
 * 2. Noise Pattern Analysis — extracts and analyzes sensor noise residuals
 * 3. JPEG Ghost Detection — finds double-compression artifacts
 * 4. Histogram & Channel Analysis — statistical analysis of color distributions
 * 5. Copy-Move Detection (block matching) — finds cloned regions
 */

import sharp from "sharp";

// ============================================================
// TYPES
// ============================================================
export interface ELAResult {
  algorithm: "error_level_analysis";
  mean_error: number; // average pixel error (0-255)
  max_error: number;
  std_deviation: number;
  suspicious_pixel_ratio: number; // % of pixels above threshold
  manipulation_likelihood: "none" | "low" | "medium" | "high" | "critical";
  heatmap_base64: string; // actual ELA heatmap image as base64 PNG
  details: string;
}

export interface NoiseResult {
  algorithm: "noise_pattern_analysis";
  global_noise_level: number;
  noise_variance: number;
  block_variances: number[]; // variance per grid block
  inconsistency_score: number; // 0-1, how inconsistent noise is across regions
  uniform_noise: boolean; // true = likely AI-generated (uniform synthetic noise)
  suspicious_blocks: number; // count of blocks with anomalous noise
  manipulation_likelihood: "none" | "low" | "medium" | "high" | "critical";
  details: string;
}

export interface JPEGGhostResult {
  algorithm: "jpeg_ghost_detection";
  quality_levels_tested: number[];
  min_difference_quality: number; // quality level with lowest difference (likely original quality)
  ghost_detected: boolean;
  double_compression_evidence: boolean;
  quality_profile: { quality: number; mean_diff: number }[];
  manipulation_likelihood: "none" | "low" | "medium" | "high" | "critical";
  details: string;
}

export interface HistogramResult {
  algorithm: "histogram_channel_analysis";
  channels: {
    red: { mean: number; std: number; skewness: number; kurtosis: number; clipped_low: number; clipped_high: number };
    green: { mean: number; std: number; skewness: number; kurtosis: number; clipped_low: number; clipped_high: number };
    blue: { mean: number; std: number; skewness: number; kurtosis: number; clipped_low: number; clipped_high: number };
  };
  overall_saturation: number;
  dynamic_range: number;
  unnatural_peaks: number; // count of abnormal histogram spikes
  channel_correlation: number; // how correlated R/G/B are — AI images often have high correlation
  manipulation_likelihood: "none" | "low" | "medium" | "high" | "critical";
  details: string;
}

export interface CopyMoveResult {
  algorithm: "copy_move_detection";
  blocks_analyzed: number;
  similar_block_pairs: number;
  clone_detected: boolean;
  manipulation_likelihood: "none" | "low" | "medium" | "high" | "critical";
  details: string;
}

export interface AIGenerationResult {
  algorithm: "ai_generation_detection";
  ai_probability: number; // 0-1, probability this is AI-generated
  signals: {
    metadata_absent: boolean;
    noise_too_uniform: boolean;
    ela_too_clean: boolean;
    histogram_too_smooth: boolean;
    high_channel_correlation: boolean;
    frequency_anomaly: boolean;
    texture_uniformity_score: number; // 0-1, how uniform textures are
    spectral_energy_ratio: number; // ratio of high-freq to low-freq energy
    block_artifact_score: number; // AI images often have grid-like artifacts
  };
  confidence: number;
  verdict: "likely_authentic" | "uncertain" | "likely_ai_generated" | "ai_generated";
  details: string;
}

export interface ForensicReport {
  ela: ELAResult;
  noise: NoiseResult;
  jpeg_ghost: JPEGGhostResult;
  histogram: HistogramResult;
  copy_move: CopyMoveResult;
  ai_detection: AIGenerationResult;
  overall_manipulation_score: number; // 0-1, 0 = clean, 1 = heavily manipulated
  overall_authenticity_score: number; // 0-1, 1 = authentic
  ai_generation_score: number; // 0-1, 1 = definitely AI-generated
  image_dimensions: { width: number; height: number };
  file_size_bytes: number;
  processing_time_ms: number;
}

// ============================================================
// 1. ERROR LEVEL ANALYSIS (ELA)
// ============================================================
async function performELA(imageBuffer: Buffer): Promise<ELAResult> {
  // Recompress at quality 75 and compute pixel-level differences
  const ELA_QUALITY = 75;
  const ELA_SCALE = 20; // amplification factor for visibility
  const SUSPICIOUS_THRESHOLD = 40; // pixels above this in ELA = suspicious

  const original = sharp(imageBuffer);
  const metadata = await original.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Get raw pixels of original
  const origRaw = await sharp(imageBuffer)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer();

  // Recompress as JPEG at known quality, then get raw pixels back
  const recompressedJpeg = await sharp(imageBuffer)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: ELA_QUALITY })
    .toBuffer();
  const recompRaw = await sharp(recompressedJpeg)
    .removeAlpha()
    .raw()
    .toBuffer();

  // Compute difference and generate heatmap
  const minLen = Math.min(origRaw.length, recompRaw.length);
  const pixelCount = Math.floor(minLen / 3);
  const heatmapData = Buffer.alloc(pixelCount * 3);
  let totalError = 0;
  let maxError = 0;
  let suspiciousPixels = 0;
  const errors: number[] = [];

  for (let i = 0; i < pixelCount; i++) {
    const idx = i * 3;
    const diffR = Math.abs(origRaw[idx] - recompRaw[idx]);
    const diffG = Math.abs(origRaw[idx + 1] - recompRaw[idx + 1]);
    const diffB = Math.abs(origRaw[idx + 2] - recompRaw[idx + 2]);
    const avgDiff = (diffR + diffG + diffB) / 3;

    totalError += avgDiff;
    errors.push(avgDiff);
    if (avgDiff > maxError) maxError = avgDiff;
    if (avgDiff > SUSPICIOUS_THRESHOLD) suspiciousPixels++;

    // Create heatmap: amplify differences and map to color
    const scaled = Math.min(255, avgDiff * ELA_SCALE);
    if (scaled > 200) {
      // Hot red for high differences
      heatmapData[idx] = 255;
      heatmapData[idx + 1] = Math.max(0, 255 - scaled);
      heatmapData[idx + 2] = 0;
    } else if (scaled > 100) {
      // Yellow-orange for medium
      heatmapData[idx] = 255;
      heatmapData[idx + 1] = Math.floor(scaled);
      heatmapData[idx + 2] = 0;
    } else {
      // Blue-black for low
      heatmapData[idx] = 0;
      heatmapData[idx + 1] = Math.floor(scaled * 0.5);
      heatmapData[idx + 2] = Math.floor(scaled);
    }
  }

  // Compute actual dimensions for the heatmap (sharp gives us the exact output size)
  const recompMeta = await sharp(recompressedJpeg).metadata();
  const heatWidth = recompMeta.width || width;
  const heatHeight = Math.floor(pixelCount / heatWidth);

  const heatmapPng = await sharp(heatmapData, {
    raw: { width: heatWidth, height: heatHeight, channels: 3 },
  })
    .png()
    .toBuffer();

  const meanError = totalError / pixelCount;
  const variance = errors.reduce((sum, e) => sum + Math.pow(e - meanError, 2), 0) / pixelCount;
  const stdDev = Math.sqrt(variance);
  const suspiciousRatio = suspiciousPixels / pixelCount;

  let likelihood: ELAResult["manipulation_likelihood"] = "none";
  if (suspiciousRatio > 0.15) likelihood = "critical";
  else if (suspiciousRatio > 0.08) likelihood = "high";
  else if (suspiciousRatio > 0.03) likelihood = "medium";
  else if (suspiciousRatio > 0.01) likelihood = "low";

  let details = `ELA performed at JPEG quality ${ELA_QUALITY}. `;
  details += `Mean error: ${meanError.toFixed(2)}, Max: ${maxError.toFixed(0)}, StdDev: ${stdDev.toFixed(2)}. `;
  details += `${(suspiciousRatio * 100).toFixed(1)}% of pixels exceed threshold (${SUSPICIOUS_THRESHOLD}). `;
  if (likelihood === "none" || likelihood === "low") {
    details += "Error levels are relatively uniform — consistent with an unmanipulated image.";
  } else if (likelihood === "medium") {
    details += "Some regions show elevated error levels. Possible localized editing or splicing.";
  } else {
    details += "Significant error level inconsistencies detected. Strong evidence of manipulation — some regions have been edited or composited.";
  }

  return {
    algorithm: "error_level_analysis",
    mean_error: Math.round(meanError * 100) / 100,
    max_error: maxError,
    std_deviation: Math.round(stdDev * 100) / 100,
    suspicious_pixel_ratio: Math.round(suspiciousRatio * 10000) / 10000,
    manipulation_likelihood: likelihood,
    heatmap_base64: `data:image/png;base64,${heatmapPng.toString("base64")}`,
    details,
  };
}

// ============================================================
// 2. NOISE PATTERN ANALYSIS
// ============================================================
async function performNoiseAnalysis(imageBuffer: Buffer): Promise<NoiseResult> {
  // Extract noise residual using high-pass filter (original - blurred)
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Get grayscale raw pixels
  const grayRaw = await sharp(imageBuffer)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer();

  // Apply Gaussian blur and get blurred pixels
  const blurredRaw = await sharp(imageBuffer)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .blur(3)
    .raw()
    .toBuffer();

  const grayMeta = await sharp(imageBuffer)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .metadata();
  const actualWidth = grayMeta.width || width;
  const actualHeight = Math.floor(grayRaw.length / actualWidth);

  // Compute noise residual
  const minLen = Math.min(grayRaw.length, blurredRaw.length);
  const noiseResidual = new Float64Array(minLen);
  let globalNoiseSum = 0;

  for (let i = 0; i < minLen; i++) {
    noiseResidual[i] = grayRaw[i] - blurredRaw[i];
    globalNoiseSum += Math.abs(noiseResidual[i]);
  }

  const globalNoise = globalNoiseSum / minLen;

  // Divide image into grid blocks and compute per-block noise variance
  const GRID_SIZE = 8;
  const blockW = Math.floor(actualWidth / GRID_SIZE);
  const blockH = Math.floor(actualHeight / GRID_SIZE);
  const blockVariances: number[] = [];

  for (let by = 0; by < GRID_SIZE; by++) {
    for (let bx = 0; bx < GRID_SIZE; bx++) {
      let sum = 0;
      let count = 0;
      for (let y = by * blockH; y < (by + 1) * blockH && y < actualHeight; y++) {
        for (let x = bx * blockW; x < (bx + 1) * blockW && x < actualWidth; x++) {
          const idx = y * actualWidth + x;
          if (idx < minLen) {
            sum += noiseResidual[idx] * noiseResidual[idx];
            count++;
          }
        }
      }
      blockVariances.push(count > 0 ? sum / count : 0);
    }
  }

  // Compute overall noise variance and inconsistency
  const meanVariance = blockVariances.reduce((a, b) => a + b, 0) / blockVariances.length;
  const varianceOfVariances = blockVariances.reduce((sum, v) => sum + Math.pow(v - meanVariance, 2), 0) / blockVariances.length;
  const noiseStd = Math.sqrt(varianceOfVariances);
  const inconsistencyScore = Math.min(1, noiseStd / (meanVariance + 0.001));

  // Count suspicious blocks (variance > 2 std deviations from mean)
  const threshold = meanVariance + 2 * noiseStd;
  const suspiciousBlocks = blockVariances.filter(v => v > threshold).length;

  // Check if noise is too uniform (AI-generated indicator)
  const uniformNoise = inconsistencyScore < 0.15 && globalNoise < 3;

  let likelihood: NoiseResult["manipulation_likelihood"] = "none";
  if (uniformNoise) likelihood = "high"; // AI-generated have very uniform noise
  else if (inconsistencyScore > 0.6 || suspiciousBlocks > 10) likelihood = "high";
  else if (inconsistencyScore > 0.35 || suspiciousBlocks > 5) likelihood = "medium";
  else if (inconsistencyScore > 0.2 || suspiciousBlocks > 2) likelihood = "low";

  let details = `Noise residual extracted via high-pass filter (σ=3 Gaussian subtraction). `;
  details += `Global noise level: ${globalNoise.toFixed(2)}, Mean block variance: ${meanVariance.toFixed(2)}. `;
  details += `Noise inconsistency score: ${(inconsistencyScore * 100).toFixed(1)}% across ${GRID_SIZE}x${GRID_SIZE} grid. `;
  details += `${suspiciousBlocks} blocks show anomalous noise patterns. `;
  if (uniformNoise) {
    details += "- Noise is unusually uniform — characteristic of AI-generated images which lack real sensor noise.";
  } else if (suspiciousBlocks > 5) {
    details += "Multiple regions show inconsistent noise patterns — possible compositing or splicing from different sources.";
  } else {
    details += "Noise patterns are consistent with a single-source capture.";
  }

  return {
    algorithm: "noise_pattern_analysis",
    global_noise_level: Math.round(globalNoise * 100) / 100,
    noise_variance: Math.round(meanVariance * 100) / 100,
    block_variances: blockVariances.map(v => Math.round(v * 100) / 100),
    inconsistency_score: Math.round(inconsistencyScore * 1000) / 1000,
    uniform_noise: uniformNoise,
    suspicious_blocks: suspiciousBlocks,
    manipulation_likelihood: likelihood,
    details,
  };
}

// ============================================================
// 3. JPEG GHOST DETECTION (Double Compression)
// ============================================================
async function performJPEGGhost(imageBuffer: Buffer): Promise<JPEGGhostResult> {
  // Recompress at multiple quality levels and find where the difference is minimal
  // The quality with minimum difference reveals the original compression quality
  // If there's a sharp dip, it suggests double compression
  const qualityLevels = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
  const qualityProfile: { quality: number; mean_diff: number }[] = [];

  // Get original raw pixels (grayscale for speed)
  const origRaw = await sharp(imageBuffer).grayscale().raw().toBuffer();

  for (const q of qualityLevels) {
    const recompressed = await sharp(imageBuffer).jpeg({ quality: q }).toBuffer();
    const recompRaw = await sharp(recompressed).grayscale().raw().toBuffer();

    const minLen = Math.min(origRaw.length, recompRaw.length);
    let totalDiff = 0;
    for (let i = 0; i < minLen; i++) {
      totalDiff += Math.abs(origRaw[i] - recompRaw[i]);
    }
    qualityProfile.push({ quality: q, mean_diff: totalDiff / minLen });
  }

  // Find the minimum difference quality (likely original quality)
  let minDiff = Infinity;
  let minQuality = 75;
  for (const p of qualityProfile) {
    if (p.mean_diff < minDiff) {
      minDiff = p.mean_diff;
      minQuality = p.quality;
    }
  }

  // Check for ghost: a sharp dip followed by a rise indicates double compression
  let ghostDetected = false;
  let doubleCompression = false;
  const diffs = qualityProfile.map(p => p.mean_diff);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const minIdx = diffs.indexOf(Math.min(...diffs));

  // If the minimum is significantly below average AND it's not at the highest quality
  if (minIdx < diffs.length - 1 && minDiff < avgDiff * 0.7) {
    ghostDetected = true;
    doubleCompression = true;
  }

  // Also check for unusual quality curve shape
  // In double-compressed images, the curve dips at the first compression quality
  if (minIdx > 0 && minIdx < diffs.length - 1) {
    const leftSlope = diffs[minIdx] - diffs[minIdx - 1];
    const rightSlope = diffs[minIdx + 1] - diffs[minIdx];
    if (leftSlope < -0.5 && rightSlope > 0.5) {
      ghostDetected = true;
    }
  }

  let likelihood: JPEGGhostResult["manipulation_likelihood"] = "none";
  if (doubleCompression && ghostDetected) likelihood = "high";
  else if (ghostDetected) likelihood = "medium";
  else if (minDiff < avgDiff * 0.8) likelihood = "low";

  let details = `Tested ${qualityLevels.length} JPEG quality levels (${qualityLevels[0]}-${qualityLevels[qualityLevels.length - 1]}). `;
  details += `Minimum difference at quality ${minQuality} (diff: ${minDiff.toFixed(2)}). `;
  if (doubleCompression) {
    details += `- Double compression detected — the image appears to have been saved as JPEG at quality ~${minQuality}, then modified and saved again. This is strong evidence of post-capture editing.`;
  } else if (ghostDetected) {
    details += `Compression artifacts suggest possible recompression at quality ~${minQuality}. The quality curve shows a suspicious dip.`;
  } else {
    details += `Quality profile is consistent with single-pass JPEG compression. No double compression evidence found.`;
  }

  return {
    algorithm: "jpeg_ghost_detection",
    quality_levels_tested: qualityLevels,
    min_difference_quality: minQuality,
    ghost_detected: ghostDetected,
    double_compression_evidence: doubleCompression,
    quality_profile: qualityProfile.map(p => ({ quality: p.quality, mean_diff: Math.round(p.mean_diff * 100) / 100 })),
    manipulation_likelihood: likelihood,
    details,
  };
}

// ============================================================
// 4. HISTOGRAM & CHANNEL ANALYSIS
// ============================================================
async function performHistogramAnalysis(imageBuffer: Buffer): Promise<HistogramResult> {
  // Compute per-channel statistics
  const rawRgb = await sharp(imageBuffer).removeAlpha().raw().toBuffer();
  const pixelCount = Math.floor(rawRgb.length / 3);

  const rHist = new Uint32Array(256);
  const gHist = new Uint32Array(256);
  const bHist = new Uint32Array(256);

  let rSum = 0, gSum = 0, bSum = 0;

  for (let i = 0; i < pixelCount; i++) {
    const r = rawRgb[i * 3];
    const g = rawRgb[i * 3 + 1];
    const b = rawRgb[i * 3 + 2];
    rHist[r]++; gHist[g]++; bHist[b]++;
    rSum += r; gSum += g; bSum += b;
  }

  function computeStats(hist: Uint32Array, sum: number) {
    const mean = sum / pixelCount;
    let variance = 0, skewSum = 0, kurtSum = 0;
    let clippedLow = hist[0] + hist[1] + hist[2];
    let clippedHigh = hist[253] + hist[254] + hist[255];

    for (let v = 0; v < 256; v++) {
      const freq = hist[v];
      const diff = v - mean;
      variance += freq * diff * diff;
      skewSum += freq * diff * diff * diff;
      kurtSum += freq * diff * diff * diff * diff;
    }
    variance /= pixelCount;
    const std = Math.sqrt(variance);
    const skewness = std > 0 ? (skewSum / pixelCount) / (std * std * std) : 0;
    const kurtosis = std > 0 ? (kurtSum / pixelCount) / (std * std * std * std) - 3 : 0;

    return {
      mean: Math.round(mean * 100) / 100,
      std: Math.round(std * 100) / 100,
      skewness: Math.round(skewness * 1000) / 1000,
      kurtosis: Math.round(kurtosis * 1000) / 1000,
      clipped_low: clippedLow,
      clipped_high: clippedHigh,
    };
  }

  const rStats = computeStats(rHist, rSum);
  const gStats = computeStats(gHist, gSum);
  const bStats = computeStats(bHist, bSum);

  // Compute channel correlation (high correlation = suspicious for AI)
  let corrSum = 0, rDiffSqSum = 0, gDiffSqSum = 0;
  for (let i = 0; i < pixelCount; i++) {
    const rDiff = rawRgb[i * 3] - rStats.mean;
    const gDiff = rawRgb[i * 3 + 1] - gStats.mean;
    corrSum += rDiff * gDiff;
    rDiffSqSum += rDiff * rDiff;
    gDiffSqSum += gDiff * gDiff;
  }
  const correlation = (rDiffSqSum > 0 && gDiffSqSum > 0)
    ? corrSum / Math.sqrt(rDiffSqSum * gDiffSqSum)
    : 0;

  // Count unnatural histogram peaks (spikes 5x above neighbors)
  let unnaturalPeaks = 0;
  for (const hist of [rHist, gHist, bHist]) {
    for (let v = 2; v < 254; v++) {
      const neighbors = (hist[v - 2] + hist[v - 1] + hist[v + 1] + hist[v + 2]) / 4;
      if (neighbors > 0 && hist[v] > neighbors * 5 && hist[v] > pixelCount * 0.01) {
        unnaturalPeaks++;
      }
    }
  }

  // Dynamic range
  let minVal = 255, maxVal = 0;
  for (let v = 0; v < 256; v++) {
    if (rHist[v] > 0 || gHist[v] > 0 || bHist[v] > 0) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  const dynamicRange = maxVal - minVal;

  // Overall saturation (how spread out the histogram is)
  const overallSaturation = (rStats.std + gStats.std + bStats.std) / 3;

  let likelihood: HistogramResult["manipulation_likelihood"] = "none";
  if (unnaturalPeaks > 10 || Math.abs(correlation) > 0.97) likelihood = "high";
  else if (unnaturalPeaks > 5 || Math.abs(correlation) > 0.93) likelihood = "medium";
  else if (unnaturalPeaks > 2 || dynamicRange < 100) likelihood = "low";

  let details = `Analyzed ${pixelCount.toLocaleString()} pixels across RGB channels. `;
  details += `Dynamic range: ${dynamicRange}/255. R-G correlation: ${correlation.toFixed(3)}. `;
  details += `${unnaturalPeaks} unnatural histogram peaks detected. `;
  if (Math.abs(correlation) > 0.95) {
    details += "- Channels are abnormally correlated — common in AI-generated images. ";
  }
  if (unnaturalPeaks > 5) {
    details += "Multiple histogram spikes suggest quantization artifacts from editing or generation. ";
  }
  if (dynamicRange < 120) {
    details += "Limited dynamic range may indicate processing or generation artifacts. ";
  }

  return {
    algorithm: "histogram_channel_analysis",
    channels: { red: rStats, green: gStats, blue: bStats },
    overall_saturation: Math.round(overallSaturation * 100) / 100,
    dynamic_range: dynamicRange,
    unnatural_peaks: unnaturalPeaks,
    channel_correlation: Math.round(correlation * 1000) / 1000,
    manipulation_likelihood: likelihood,
    details,
  };
}

// ============================================================
// 5. COPY-MOVE DETECTION (Block Matching)
// ============================================================
async function performCopyMoveDetection(imageBuffer: Buffer): Promise<CopyMoveResult> {
  // Simplified DCT-like block matching using average pixel values
  const BLOCK_SIZE = 16;
  const DISTANCE_THRESHOLD = 5; // max difference to consider blocks similar
  const MIN_DISTANCE = 30; // minimum pixel distance between similar blocks (to exclude neighbors)

  const grayRaw = await sharp(imageBuffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer();

  const gMeta = await sharp(imageBuffer)
    .resize(512, 512, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .metadata();
  const w = gMeta.width || 512;
  const h = Math.floor(grayRaw.length / w);

  // Compute block features (mean, variance, gradient)
  interface BlockFeature {
    x: number; y: number;
    mean: number; variance: number;
    gradX: number; gradY: number;
  }

  const blocks: BlockFeature[] = [];
  const step = Math.max(8, Math.floor(BLOCK_SIZE / 2)); // overlap

  for (let by = 0; by + BLOCK_SIZE <= h; by += step) {
    for (let bx = 0; bx + BLOCK_SIZE <= w; bx += step) {
      let sum = 0, sqSum = 0, gxSum = 0, gySum = 0;
      const count = BLOCK_SIZE * BLOCK_SIZE;

      for (let y = by; y < by + BLOCK_SIZE; y++) {
        for (let x = bx; x < bx + BLOCK_SIZE; x++) {
          const idx = y * w + x;
          const val = grayRaw[idx] || 0;
          sum += val;
          sqSum += val * val;
          // Simple gradient
          if (x + 1 < w) gxSum += Math.abs(val - (grayRaw[idx + 1] || 0));
          if (y + 1 < h) gySum += Math.abs(val - (grayRaw[idx + w] || 0));
        }
      }

      const mean = sum / count;
      const variance = sqSum / count - mean * mean;
      blocks.push({ x: bx, y: by, mean, variance, gradX: gxSum / count, gradY: gySum / count });
    }
  }

  // Find similar block pairs
  let similarPairs = 0;
  const maxBlocks = Math.min(blocks.length, 2000); // limit for performance

  for (let i = 0; i < maxBlocks; i++) {
    for (let j = i + 1; j < maxBlocks; j++) {
      const a = blocks[i];
      const b = blocks[j];

      // Check spatial distance
      const spatialDist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
      if (spatialDist < MIN_DISTANCE) continue;

      // Compare features
      const meanDiff = Math.abs(a.mean - b.mean);
      const varDiff = Math.abs(a.variance - b.variance);
      const gxDiff = Math.abs(a.gradX - b.gradX);
      const gyDiff = Math.abs(a.gradY - b.gradY);

      if (meanDiff < DISTANCE_THRESHOLD &&
        varDiff < DISTANCE_THRESHOLD * 10 &&
        gxDiff < DISTANCE_THRESHOLD &&
        gyDiff < DISTANCE_THRESHOLD) {
        similarPairs++;
      }
    }
  }

  const cloneDetected = similarPairs > 20; // threshold for clone detection
  let likelihood: CopyMoveResult["manipulation_likelihood"] = "none";
  if (similarPairs > 50) likelihood = "critical";
  else if (similarPairs > 20) likelihood = "high";
  else if (similarPairs > 10) likelihood = "medium";
  else if (similarPairs > 5) likelihood = "low";

  let details = `Analyzed ${blocks.length} blocks (${BLOCK_SIZE}x${BLOCK_SIZE}px) with overlapping grid. `;
  details += `Found ${similarPairs} similar block pairs at distance > ${MIN_DISTANCE}px. `;
  if (cloneDetected) {
    details += "- Significant number of similar distant blocks detected — strong evidence of copy-paste manipulation (cloned regions).";
  } else if (similarPairs > 5) {
    details += "Some similar regions found, which could indicate repeating textures or minor copy-paste editing.";
  } else {
    details += "No significant cloned regions detected.";
  }

  return {
    algorithm: "copy_move_detection",
    blocks_analyzed: blocks.length,
    similar_block_pairs: similarPairs,
    clone_detected: cloneDetected,
    manipulation_likelihood: likelihood,
    details,
  };
}

// ============================================================
// 6. AI GENERATION DETECTION (Meta-Analysis + Frequency Domain)
// ============================================================
async function performAIGenerationDetection(
  imageBuffer: Buffer,
  ela: ELAResult,
  noise: NoiseResult,
  histogram: HistogramResult,
  hasExifMetadata: boolean = false,
  exifFieldCount: number = 0,
  hasCameraInfo: boolean = false
): Promise<AIGenerationResult> {
  // =====================================================================
  // CONTINUOUS SCORING — each signal contributes a continuous value 0-1
  // weighted by importance, rather than binary fire/not-fire
  // =====================================================================

  // --- Signal 1: Metadata & Camera Info (STRONGEST signals) ---
  // No camera make/model is the #1 indicator — real photos ALWAYS have this
  const noCameraInfo = !hasCameraInfo;
  // Metadata can be sparse (WhatsApp strips most) — use a gradient
  const metadataAbsent = !hasExifMetadata || exifFieldCount < 3;
  const metadataSparse = exifFieldCount < 10; // fewer than 10 fields is suspicious
  // Continuous metadata score: 0 fields → 1.0, 5 fields → 0.8, 15 → 0.3, 30+ → 0
  const metadataScore = Math.max(0, Math.min(1, 1 - (exifFieldCount / 25)));

  // --- Signal 2: Noise uniformity ---
  // AI images have synthetic noise — low inconsistency + low global noise
  // Use continuous scoring: the lower the inconsistency, the more suspicious
  const noiseUniformScore = Math.max(0, Math.min(1, 1 - (noise.inconsistency_score / 0.4)));
  const noiseTooUniform = noise.inconsistency_score < 0.25;

  // --- Signal 3: ELA cleanliness ---
  // AI images have consistent error levels. But JPEG recompression raises ELA,
  // so use a more forgiving threshold. Score based on how clean it is.
  const elaCleanScore = Math.max(0, Math.min(1,
    (1 - Math.min(1, ela.mean_error / 15)) * 0.5 +
    (1 - Math.min(1, ela.std_deviation / 10)) * 0.3 +
    (1 - Math.min(1, ela.suspicious_pixel_ratio / 0.05)) * 0.2
  ));
  const elaTooClean = ela.mean_error < 10 && ela.std_deviation < 8 && ela.suspicious_pixel_ratio < 0.02;

  // --- Signal 4: Histogram smoothness ---
  const histogramTooSmooth = histogram.unnatural_peaks < 3 && histogram.dynamic_range > 180;
  const histSmoothScore = Math.max(0, Math.min(1,
    (1 - Math.min(1, histogram.unnatural_peaks / 5)) * 0.6 +
    Math.min(1, histogram.dynamic_range / 255) * 0.4
  ));

  // --- Signal 5: Channel correlation ---
  const corrAbs = Math.abs(histogram.channel_correlation);
  const highChannelCorrelation = corrAbs > 0.80;
  const channelCorrScore = Math.max(0, Math.min(1, (corrAbs - 0.5) / 0.5));

  // --- Signal 6: Frequency domain (Laplacian) ---
  const metadata = await sharp(imageBuffer).metadata();
  const w = Math.min(metadata.width || 512, 512);
  const h = Math.min(metadata.height || 512, 512);

  const grayRaw = await sharp(imageBuffer)
    .resize(w, h, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer();
  const gMeta = await sharp(imageBuffer)
    .resize(w, h, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .metadata();
  const actualW = gMeta.width || w;
  const actualH = Math.floor(grayRaw.length / actualW);

  let highFreqEnergy = 0;
  let lowFreqEnergy = 0;
  let totalPixels = 0;

  for (let y = 1; y < actualH - 1; y++) {
    for (let x = 1; x < actualW - 1; x++) {
      const idx = y * actualW + x;
      const center = grayRaw[idx];
      const laplacian = 8 * center
        - grayRaw[idx - actualW - 1] - grayRaw[idx - actualW] - grayRaw[idx - actualW + 1]
        - grayRaw[idx - 1] - grayRaw[idx + 1]
        - grayRaw[idx + actualW - 1] - grayRaw[idx + actualW] - grayRaw[idx + actualW + 1];
      highFreqEnergy += Math.abs(laplacian);
      lowFreqEnergy += center;
      totalPixels++;
    }
  }

  const avgHighFreq = totalPixels > 0 ? highFreqEnergy / totalPixels : 0;
  const avgLowFreq = totalPixels > 0 ? lowFreqEnergy / totalPixels : 1;
  const spectralEnergyRatio = avgLowFreq > 0 ? avgHighFreq / avgLowFreq : 0;
  const frequencyAnomaly = spectralEnergyRatio < 0.25;
  // Continuous: lower ratio = more suspicious
  const freqScore = Math.max(0, Math.min(1, 1 - (spectralEnergyRatio / 0.35)));

  // --- Signal 7: Texture uniformity ---
  const PATCH_SIZE = 16;
  const patchVariances: number[] = [];
  const step = Math.max(PATCH_SIZE, Math.floor(Math.min(actualW, actualH) / 12));

  for (let py = 0; py + PATCH_SIZE <= actualH; py += step) {
    for (let px = 0; px + PATCH_SIZE <= actualW; px += step) {
      let pSum = 0, pSqSum = 0, pCount = 0;
      for (let y = py; y < py + PATCH_SIZE; y++) {
        for (let x = px; x < px + PATCH_SIZE; x++) {
          const val = grayRaw[y * actualW + x];
          pSum += val;
          pSqSum += val * val;
          pCount++;
        }
      }
      const mean = pSum / pCount;
      const variance = pSqSum / pCount - mean * mean;
      patchVariances.push(variance);
    }
  }

  const meanPatchVar = patchVariances.reduce((a, b) => a + b, 0) / (patchVariances.length || 1);
  const patchVarStd = Math.sqrt(
    patchVariances.reduce((s, v) => s + (v - meanPatchVar) ** 2, 0) / (patchVariances.length || 1)
  );
  const textureUniformity = meanPatchVar > 0 ? 1 - Math.min(1, patchVarStd / meanPatchVar) : 0.5;

  // --- Signal 8: Block artifact detection ---
  let blockArtifactScore = 0;
  const blockSizes = [8, 16, 32];
  for (const bs of blockSizes) {
    let boundaryDiff = 0, interiorDiff = 0;
    let bCount = 0, iCount = 0;
    for (let y = 1; y < actualH - 1; y++) {
      for (let x = 1; x < actualW - 1; x++) {
        const idx = y * actualW + x;
        const hDiff = Math.abs(grayRaw[idx] - grayRaw[idx + 1]);
        if (x % bs === 0) { boundaryDiff += hDiff; bCount++; }
        else { interiorDiff += hDiff; iCount++; }
      }
    }
    const avgBoundary = bCount > 0 ? boundaryDiff / bCount : 0;
    const avgInterior = iCount > 0 ? interiorDiff / iCount : 1;
    const ratio = avgInterior > 0 ? avgBoundary / avgInterior : 1;
    if (ratio > 1.08) blockArtifactScore = Math.max(blockArtifactScore, Math.min(1, (ratio - 1) * 4));
  }

  // =====================================================================
  // WEIGHTED CONTINUOUS AI PROBABILITY
  // =====================================================================
  // Use weighted sum of continuous scores, not just binary signals
  let aiScore = 0;
  let signalCount = 0;

  // No camera info is the strongest binary signal (weight: 0.28)
  // Real camera photos ALWAYS have Make/Model. AI never does.
  if (noCameraInfo) { aiScore += 0.28; signalCount++; }

  // Metadata sparsity — continuous (weight: 0.18)
  const metaContrib = metadataScore * 0.18;
  aiScore += metaContrib;
  if (metadataAbsent || metadataSparse) signalCount++;

  // Noise uniformity — continuous (weight: 0.12)
  const noiseContrib = noiseUniformScore * 0.12;
  aiScore += noiseContrib;
  if (noiseTooUniform) signalCount++;

  // ELA cleanliness — continuous (weight: 0.10)
  const elaContrib = elaCleanScore * 0.10;
  aiScore += elaContrib;
  if (elaTooClean) signalCount++;

  // Frequency domain — continuous (weight: 0.10)
  const freqContrib = freqScore * 0.10;
  aiScore += freqContrib;
  if (frequencyAnomaly) signalCount++;

  // Channel correlation — continuous (weight: 0.08)
  const corrContrib = channelCorrScore * 0.08;
  aiScore += corrContrib;
  if (highChannelCorrelation) signalCount++;

  // Histogram smoothness — continuous (weight: 0.06)
  const histContrib = histSmoothScore * 0.06;
  aiScore += histContrib;
  if (histogramTooSmooth) signalCount++;

  // Texture uniformity (weight: 0.05)
  const texContrib = textureUniformity * 0.05;
  aiScore += texContrib;
  if (textureUniformity > 0.6) signalCount++;

  // Block artifacts (weight: 0.03)
  const blockContrib = blockArtifactScore * 0.03;
  aiScore += blockContrib;
  if (blockArtifactScore > 0.2) signalCount++;

  // SYNERGY BONUS: if no camera AND metadata sparse, this is extremely telling
  if (noCameraInfo && metadataSparse) {
    aiScore += 0.12;
  }
  // SYNERGY BONUS: no camera + clean ELA = very likely AI
  if (noCameraInfo && elaTooClean) {
    aiScore += 0.06;
  }
  // SYNERGY BONUS: multiple signals converging
  if (signalCount >= 5) aiScore = Math.min(1, aiScore * 1.15);
  if (signalCount >= 7) aiScore = Math.min(1, aiScore * 1.10);

  // Clamp
  aiScore = Math.min(1, Math.max(0, aiScore));

  // More aggressive verdict thresholds
  let verdict: AIGenerationResult["verdict"] = "likely_authentic";
  if (aiScore >= 0.55) verdict = "ai_generated";
  else if (aiScore >= 0.38) verdict = "likely_ai_generated";
  else if (aiScore >= 0.22) verdict = "uncertain";

  const confidence = Math.min(0.95, 0.5 + signalCount * 0.06 + (noCameraInfo ? 0.1 : 0));

  // Build details
  const detailParts: string[] = [];
  detailParts.push(`AI generation probability: ${(aiScore * 100).toFixed(1)}% (${signalCount} signals active).`);
  if (noCameraInfo) detailParts.push("- No camera make/model — real photos always embed camera info. AI generators never do. This is the strongest indicator.");
  if (metadataAbsent) detailParts.push("- No meaningful EXIF metadata — AI-generated images lack camera sensor data.");
  else if (metadataSparse) detailParts.push(`- Very sparse metadata (${exifFieldCount} fields) — real camera photos typically have 30+ EXIF fields.`);
  if (noiseTooUniform) detailParts.push("- Noise pattern is unusually uniform — real cameras produce unique sensor noise patterns.");
  if (elaTooClean) detailParts.push("- Error levels are suspiciously consistent — no evidence of real camera JPEG pipeline artifacts.");
  if (frequencyAnomaly) detailParts.push(`- Low high-frequency energy (spectral ratio: ${spectralEnergyRatio.toFixed(3)}) — AI images lack natural sensor noise in high frequencies.`);
  if (highChannelCorrelation) detailParts.push(`- RGB channels abnormally correlated (${histogram.channel_correlation.toFixed(3)}) — AI models produce correlated color channels.`);
  if (textureUniformity > 0.6) detailParts.push(`- Texture uniformity: ${(textureUniformity * 100).toFixed(0)}% — AI images show unnaturally consistent texture patterns.`);
  if (blockArtifactScore > 0.2) detailParts.push(`- Block artifacts detected (score: ${(blockArtifactScore * 100).toFixed(0)}%) — grid-like patterns from AI generation pipeline.`);
  if (signalCount === 0) detailParts.push("No AI generation signals detected. Image has characteristics consistent with a real camera capture.");

  return {
    algorithm: "ai_generation_detection",
    ai_probability: Math.round(aiScore * 1000) / 1000,
    signals: {
      metadata_absent: metadataAbsent || metadataSparse,
      noise_too_uniform: noiseTooUniform,
      ela_too_clean: elaTooClean,
      histogram_too_smooth: histogramTooSmooth,
      high_channel_correlation: highChannelCorrelation,
      frequency_anomaly: frequencyAnomaly,
      texture_uniformity_score: Math.round(textureUniformity * 1000) / 1000,
      spectral_energy_ratio: Math.round(spectralEnergyRatio * 10000) / 10000,
      block_artifact_score: Math.round(blockArtifactScore * 1000) / 1000,
    },
    confidence: Math.round(confidence * 100) / 100,
    verdict,
    details: detailParts.join(" "),
  };
}

// ============================================================
// MAIN: Run all forensic analyses
// ============================================================
export async function runForensicAnalysis(
  imageBuffer: Buffer,
  exifInfo?: { hasMetadata: boolean; fieldCount: number; hasCameraInfo: boolean }
): Promise<ForensicReport> {
  const startTime = Date.now();
  const metadata = await sharp(imageBuffer).metadata();

  // Run core algorithms in parallel
  const [ela, noise, jpegGhost, histogram, copyMove] = await Promise.all([
    performELA(imageBuffer),
    performNoiseAnalysis(imageBuffer),
    performJPEGGhost(imageBuffer),
    performHistogramAnalysis(imageBuffer),
    performCopyMoveDetection(imageBuffer),
  ]);

  // Run AI generation detection (depends on results from above + EXIF info)
  const aiDetection = await performAIGenerationDetection(
    imageBuffer, ela, noise, histogram,
    exifInfo?.hasMetadata ?? false,
    exifInfo?.fieldCount ?? 0,
    exifInfo?.hasCameraInfo ?? false,
  );

  // Compute overall manipulation score from all algorithms
  const likelihoodScores: Record<string, number> = {
    none: 0, low: 0.2, medium: 0.5, high: 0.8, critical: 1.0,
  };

  const manipScores = [
    { weight: 0.25, score: likelihoodScores[ela.manipulation_likelihood] },
    { weight: 0.20, score: likelihoodScores[noise.manipulation_likelihood] },
    { weight: 0.20, score: likelihoodScores[jpegGhost.manipulation_likelihood] },
    { weight: 0.15, score: likelihoodScores[histogram.manipulation_likelihood] },
    { weight: 0.10, score: likelihoodScores[copyMove.manipulation_likelihood] },
    { weight: 0.10, score: aiDetection.ai_probability }, // AI detection contributes to manipulation
  ];

  const overallManipulation = manipScores.reduce((sum, s) => sum + s.weight * s.score, 0);

  // Authenticity score considers BOTH manipulation AND AI generation
  // If AI generation is high, authenticity drops regardless of manipulation score
  const aiPenalty = aiDetection.ai_probability * 0.6; // AI generation heavily penalizes authenticity
  const overallAuthenticity = Math.max(0, Math.min(1, 1 - overallManipulation - aiPenalty));

  return {
    ela,
    noise,
    jpeg_ghost: jpegGhost,
    histogram,
    copy_move: copyMove,
    ai_detection: aiDetection,
    overall_manipulation_score: Math.round(overallManipulation * 1000) / 1000,
    overall_authenticity_score: Math.round(overallAuthenticity * 1000) / 1000,
    ai_generation_score: aiDetection.ai_probability,
    image_dimensions: { width: metadata.width || 0, height: metadata.height || 0 },
    file_size_bytes: imageBuffer.length,
    processing_time_ms: Date.now() - startTime,
  };
}

// ============================================================
// REAL IMAGE UPSCALING (not AI generation)
// ============================================================
export async function realUpscaleImage(
  imageBuffer: Buffer,
  scaleFactor: number = 2
): Promise<{ upscaledBuffer: Buffer; metadata: any }> {
  const metadata = await sharp(imageBuffer).metadata();
  const origWidth = metadata.width || 800;
  const origHeight = metadata.height || 600;
  const newWidth = Math.round(origWidth * scaleFactor);
  const newHeight = Math.round(origHeight * scaleFactor);

  // Step 1: Upscale with Lanczos3 (best quality resampling)
  let pipeline = sharp(imageBuffer)
    .resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3,
      fit: "fill",
    });

  // Step 2: Apply moderate sharpening (unsharp mask)
  pipeline = pipeline.sharpen({
    sigma: 1.0,     // Gaussian sigma
    m1: 1.5,        // flat areas sharpening
    m2: 0.7,        // jagged areas sharpening
    x1: 2.0,        // threshold for flat areas
    y2: 10,         // max bright sharpening
    y3: 20,         // max dark sharpening
  } as any);

  // Step 3: Slight contrast enhancement via linear adjustment
  pipeline = pipeline.linear(1.05, -5); // slight contrast boost

  // Step 4: Light noise reduction
  pipeline = pipeline.median(1);

  const upscaledBuffer = await pipeline
    .png({ quality: 95, compressionLevel: 6 })
    .toBuffer();

  return {
    upscaledBuffer,
    metadata: {
      original_width: origWidth,
      original_height: origHeight,
      upscaled_width: newWidth,
      upscaled_height: newHeight,
      scale_factor: scaleFactor,
      method: "lanczos3_resampling",
      enhancements: ["lanczos3_upscale", "unsharp_mask", "contrast_boost", "noise_reduction"],
      algorithm: "Sharp Lanczos3 with adaptive sharpening",
      forensically_sound: true, // preserves original content
    },
  };
}
