import type { TelemetryDataPoint, TelemetrySession } from '../types/telemetry.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number.parseFloat(value);
  return Number.NaN;
};

export const parseTelemetryFile = async (file: File): Promise<TelemetrySession> => {
  const fileName = file.name.replace(/\.[^/.]+$/, '');

  if (file.name.toLowerCase().endsWith('.json')) {
    const text = await file.text();
    try {
      const jsonData: unknown = JSON.parse(text);
      const data = Array.isArray(jsonData)
        ? jsonData
        : isRecord(jsonData) && Array.isArray(jsonData.data)
          ? jsonData.data
          : [];
      if (data.length === 0) throw new Error('No telemetry data found in file');
      const validatedData = validateAndCleanData(data);
      return createTelemetrySession(fileName, validatedData);
    } catch {
      throw new Error('Invalid JSON format');
    }
  } else if (file.name.toLowerCase().endsWith('.csv')) {
    const text = await file.text();
    const data = parseCSV(text);
    if (data.length === 0) throw new Error('No telemetry data found in file');
    const validatedData = validateAndCleanData(data);
    return createTelemetrySession(fileName, validatedData);
  } else if (file.name.toLowerCase().endsWith('.mp4')) {
    throw new Error('Video files do not contain supported telemetry. Provide a unit-labelled CSV or JSON session.');
  } else {
    throw new Error('Unsupported telemetry format. Please upload a CSV or JSON file.');
  }
};

const parseCSV = (csvText: string): TelemetryDataPoint[] => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('Invalid CSV format');
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const data: TelemetryDataPoint[] = [];
  
  const getColumnIndex = (possibleNames: string[]) => {
    return possibleNames.map(name => headers.indexOf(name)).find(index => index !== -1) ?? -1;
  };
  
  const timestampIndex = getColumnIndex(['timestamp', 'time', 't']);
  const speedIndex = getColumnIndex(['speed', 'velocity', 'mph', 'kph']);
  const brakeIndex = getColumnIndex(['brake', 'brake_pressure', 'brakes']);
  const throttleIndex = getColumnIndex(['throttle', 'accelerator', 'gas', 'accel']);
  const steeringIndex = getColumnIndex(['steering', 'steer', 'wheel_angle']);
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) continue;
    
    const dataPoint: TelemetryDataPoint = {
      timestamp: timestampIndex >= 0 ? parseFloat(values[timestampIndex]) || i : i,
      speed: speedIndex >= 0 ? parseFloat(values[speedIndex]) || 0 : 0,
      brake: brakeIndex >= 0 ? parseFloat(values[brakeIndex]) || 0 : 0,
      throttle: throttleIndex >= 0 ? parseFloat(values[throttleIndex]) || 0 : 0,
      steering: steeringIndex >= 0 ? parseFloat(values[steeringIndex]) || 0 : 0,
    };
    
    data.push(dataPoint);
  }
  
  return data;
};

const validateAndCleanData = (data: unknown[]): TelemetryDataPoint[] => {
  return data
    .filter(isRecord)
    .map((point, index) => ({
      timestamp: typeof point.timestamp === 'number' ? point.timestamp : index,
      speed: Math.max(0, toNumber(point.speed) || 0),
      brake: Math.max(0, Math.min(1, toNumber(point.brake) || 0)),
      throttle: Math.max(0, Math.min(1, toNumber(point.throttle) || 0)),
      steering: Math.max(-1, Math.min(1, toNumber(point.steering) || 0)),
      lat: point.lat ? toNumber(point.lat) : undefined,
      lng: point.lng ? toNumber(point.lng) : undefined,
      gForceX: point.gForceX ? toNumber(point.gForceX) : undefined,
      gForceY: point.gForceY ? toNumber(point.gForceY) : undefined,
      rpm: point.rpm ? toNumber(point.rpm) : undefined,
    }))
    .filter(point => point.speed > 0 || point.throttle > 0 || point.brake > 0);
};

const createTelemetrySession = (name: string, data: TelemetryDataPoint[]): TelemetrySession => {
  const speeds = data.map(d => d.speed);
  const maxSpeed = Math.max(...speeds);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const duration = data[data.length - 1].timestamp - data[0].timestamp;
  
  return {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    data,
    duration,
    maxSpeed,
    avgSpeed,
    uploadedAt: new Date(),
  };
};
