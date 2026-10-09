export interface TelemetryDataPoint {
  timestamp: number;
  speed: number;
  brake: number;
  throttle: number;
  steering: number;
  lat?: number;
  lng?: number;
  gForceX?: number;
  gForceY?: number;
  rpm?: number;
}

export interface TelemetrySession {
  id: string;
  name: string;
  data: TelemetryDataPoint[];
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
  uploadedAt: Date;
}

export interface CoachingInsight {
  id: string;
  type: 'braking' | 'acceleration' | 'cornering' | 'smoothness' | 'consistency';
  title: string;
  message: string;
  timestamp?: number;
  severity: 'positive' | 'neutral' | 'improvement';
  score: number;
}

export interface AnalysisResult {
  insights: CoachingInsight[];
  overallScore: number;
  strengths: string[];
  improvements: string[];
  summary: string;
}