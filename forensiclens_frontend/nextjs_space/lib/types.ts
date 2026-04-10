export interface PhotoRecord {
  id: string;
  userId: string;
  originalCloudPath: string | null;
  originalUrl: string | null;
  isOriginalPublic: boolean;
  anomalyCloudPath: string | null;
  anomalyUrl: string | null;
  isAnomalyPublic: boolean;
  upscaledCloudPath: string | null;
  upscaledUrl: string | null;
  isUpscaledPublic: boolean;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  status: string;
  anomalyStatus: string;
  upscaleStatus: string;
  anomalyData: any;
  upscaleData: any;
  backendPhotoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  totalPhotos: number;
  anomaliesDetected: number;
  photosUpscaled: number;
  processingCount: number;
}

export interface BackendUploadResponse {
  id: string;
  filename: string;
  file_path: string;
  upload_time: string;
}

export interface BackendAnomalyResponse {
  photo_id: string;
  status: string;
  anomalies: any;
  result_path?: string;
}

export interface BackendUpscaleResponse {
  photo_id: string;
  status: string;
  result_path?: string;
}
