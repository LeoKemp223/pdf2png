
export interface WatermarkDetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  backgroundColor: string; // Hex color code or "white"
  description: string;
}

export interface ProcessingStep {
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

export enum AppStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  READY_TO_PROCESS = 'READY_TO_PROCESS',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED'
}
