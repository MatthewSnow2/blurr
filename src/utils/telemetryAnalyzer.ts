import { TelemetryDataPoint, TelemetrySession, CoachingInsight, AnalysisResult } from '../types/telemetry';

export const analyzeTelemetryData = (session: TelemetrySession): AnalysisResult => {
  const insights: CoachingInsight[] = [];
  let totalScore = 0;
  const scores: number[] = [];

  // Analyze different aspects of driving
  const brakingAnalysis = analyzeBraking(session.data);
  const accelerationAnalysis = analyzeAcceleration(session.data);
  const corneringAnalysis = analyzeCornering(session.data);
  const smoothnessAnalysis = analyzeSmoothness(session.data);
  const consistencyAnalysis = analyzeConsistency(session.data);

  insights.push(...brakingAnalysis.insights);
  insights.push(...accelerationAnalysis.insights);
  insights.push(...corneringAnalysis.insights);
  insights.push(...smoothnessAnalysis.insights);
  insights.push(...consistencyAnalysis.insights);

  scores.push(brakingAnalysis.score, accelerationAnalysis.score, corneringAnalysis.score, 
              smoothnessAnalysis.score, consistencyAnalysis.score);

  totalScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const strengths = insights
    .filter(i => i.severity === 'positive')
    .map(i => i.title)
    .slice(0, 3);

  const improvements = insights
    .filter(i => i.severity === 'improvement')
    .map(i => i.title)
    .slice(0, 3);

  const summary = generateCoachingSummary(totalScore, strengths, improvements);

  return {
    insights: insights.sort((a, b) => b.score - a.score),
    overallScore: Math.round(totalScore),
    strengths,
    improvements,
    summary,
  };
};

const analyzeBraking = (data: TelemetryDataPoint[]) => {
  const insights: CoachingInsight[] = [];
  let score = 85;

  const brakingEvents = data.filter(d => d.brake > 0.1);
  const hardBrakingEvents = brakingEvents.filter(d => d.brake > 0.8);
  
  if (hardBrakingEvents.length === 0) {
    insights.push({
      id: 'smooth_braking',
      type: 'braking',
      title: 'Excellent Brake Control',
      message: 'Outstanding! You maintained smooth, progressive braking throughout your session. This shows great anticipation and car control.',
      severity: 'positive',
      score: 95,
    });
    score = 95;
  } else if (hardBrakingEvents.length < brakingEvents.length * 0.1) {
    insights.push({
      id: 'good_braking',
      type: 'braking',
      title: 'Good Braking Technique',
      message: 'Great job! You used hard braking sparingly and showed good brake modulation. Keep up the smooth approach.',
      severity: 'positive',
      score: 88,
    });
    score = 88;
  } else {
    insights.push({
      id: 'improve_braking',
      type: 'braking',
      title: 'Braking Refinement Opportunity',
      message: 'Try to anticipate braking zones earlier for smoother, more progressive brake application. This will improve your lap times and tire wear.',
      severity: 'improvement',
      score: 72,
    });
    score = 72;
  }

  return { insights, score };
};

const analyzeAcceleration = (data: TelemetryDataPoint[]) => {
  const insights: CoachingInsight[] = [];
  let score = 85;

  const throttleApplications = data.filter(d => d.throttle > 0.1);
  const smoothThrottleTransitions = throttleApplications.filter((d, i) => {
    if (i === 0) return true;
    const prev = throttleApplications[i - 1];
    return Math.abs(d.throttle - prev.throttle) < 0.3;
  });

  const smoothnessRatio = smoothThrottleTransitions.length / throttleApplications.length;

  if (smoothnessRatio > 0.9) {
    insights.push({
      id: 'smooth_throttle',
      type: 'acceleration',
      title: 'Masterful Throttle Control',
      message: 'Exceptional throttle modulation! Your smooth, progressive acceleration technique is textbook perfect. This is how champions drive.',
      severity: 'positive',
      score: 94,
    });
    score = 94;
  } else if (smoothnessRatio > 0.7) {
    insights.push({
      id: 'good_throttle',
      type: 'acceleration',
      title: 'Strong Acceleration Technique',
      message: 'Really nice throttle control! Your progressive acceleration shows good understanding of traction management.',
      severity: 'positive',
      score: 87,
    });
    score = 87;
  } else {
    insights.push({
      id: 'improve_throttle',
      type: 'acceleration',
      title: 'Throttle Smoothness Focus',
      message: 'Focus on more gradual throttle application, especially coming out of corners. Smooth inputs will give you better traction and faster times.',
      severity: 'improvement',
      score: 75,
    });
    score = 75;
  }

  return { insights, score };
};

const analyzeCornering = (data: TelemetryDataPoint[]) => {
  const insights: CoachingInsight[] = [];
  let score = 85;

  const corneringData = data.filter(d => Math.abs(d.steering) > 0.1);
  const aggressiveSteering = corneringData.filter(d => Math.abs(d.steering) > 0.8);

  if (corneringData.length === 0) {
    score = 80;
    return { insights, score };
  }

  const aggressiveRatio = aggressiveSteering.length / corneringData.length;

  if (aggressiveRatio < 0.05) {
    insights.push({
      id: 'smooth_cornering',
      type: 'cornering',
      title: 'Exceptional Corner Precision',
      message: 'Beautiful cornering technique! Your smooth, measured steering inputs show excellent car control and line selection.',
      severity: 'positive',
      score: 93,
    });
    score = 93;
  } else if (aggressiveRatio < 0.15) {
    insights.push({
      id: 'good_cornering',
      type: 'cornering',
      title: 'Solid Cornering Performance',
      message: 'Good steering control through the corners. Your measured approach is paying off with clean, consistent lines.',
      severity: 'positive',
      score: 86,
    });
    score = 86;
  } else {
    insights.push({
      id: 'improve_cornering',
      type: 'cornering',
      title: 'Steering Refinement',
      message: 'Try to be even more gradual with steering inputs. Smooth, early turn-in will help you maintain better balance and speed through corners.',
      severity: 'improvement',
      score: 74,
    });
    score = 74;
  }

  return { insights, score };
};

const analyzeSmoothness = (data: TelemetryDataPoint[]) => {
  const insights: CoachingInsight[] = [];
  let score = 85;

  // Calculate input variation
  let totalVariation = 0;
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    
    totalVariation += Math.abs(curr.throttle - prev.throttle);
    totalVariation += Math.abs(curr.brake - prev.brake);
    totalVariation += Math.abs(curr.steering - prev.steering);
  }

  const avgVariation = totalVariation / (data.length - 1);

  if (avgVariation < 0.05) {
    insights.push({
      id: 'exceptional_smoothness',
      type: 'smoothness',
      title: 'Silk-Smooth Driving',
      message: 'Absolutely incredible smoothness! Your inputs are so refined and progressive. This level of control is what separates great drivers from good ones.',
      severity: 'positive',
      score: 96,
    });
    score = 96;
  } else if (avgVariation < 0.1) {
    insights.push({
      id: 'good_smoothness',
      type: 'smoothness',
      title: 'Excellent Input Control',
      message: 'Really smooth driving! Your consistent, measured inputs show great car control and understanding of vehicle dynamics.',
      severity: 'positive',
      score: 89,
    });
    score = 89;
  } else {
    insights.push({
      id: 'improve_smoothness',
      type: 'smoothness',
      title: 'Focus on Smoothness',
      message: 'Work on making your inputs even more gradual and progressive. Smooth is fast - the car responds better to gentle, deliberate movements.',
      severity: 'improvement',
      score: 76,
    });
    score = 76;
  }

  return { insights, score };
};

const analyzeConsistency = (data: TelemetryDataPoint[]) => {
  const insights: CoachingInsight[] = [];
  let score = 85;

  // Analyze speed consistency in similar sections
  const speeds = data.map(d => d.speed);
  const speedVariance = calculateVariance(speeds);
  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const consistencyRatio = 1 - (speedVariance / (avgSpeed * avgSpeed));

  if (consistencyRatio > 0.9) {
    insights.push({
      id: 'exceptional_consistency',
      type: 'consistency',
      title: 'Remarkable Consistency',
      message: 'Outstanding consistency! Your ability to repeat similar speeds and lines lap after lap is the hallmark of a skilled driver.',
      severity: 'positive',
      score: 95,
    });
    score = 95;
  } else if (consistencyRatio > 0.8) {
    insights.push({
      id: 'good_consistency',
      type: 'consistency',
      title: 'Strong Consistency',
      message: 'Great job maintaining consistent performance! Your repeatable driving style is building a solid foundation for improvement.',
      severity: 'positive',
      score: 87,
    });
    score = 87;
  } else {
    insights.push({
      id: 'improve_consistency',
      type: 'consistency',
      title: 'Consistency Development',
      message: 'Focus on repeating your best lines and techniques. Consistency is key to finding speed - nail down your basics first.',
      severity: 'improvement',
      score: 73,
    });
    score = 73;
  }

  return { insights, score };
};

const calculateVariance = (numbers: number[]): number => {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
};

const generateCoachingSummary = (score: number, strengths: string[], improvements: string[]): string => {
  let summary = '';
  
  if (score >= 90) {
    summary = 'Exceptional driving performance! You\'re demonstrating advanced car control and racing technique. ';
  } else if (score >= 80) {
    summary = 'Strong driving performance! You\'re showing good fundamentals and smooth technique. ';
  } else if (score >= 70) {
    summary = 'Good foundation with clear areas for improvement. Focus on the basics and consistency. ';
  } else {
    summary = 'Keep practicing! Every great driver started where you are now. Focus on smoothness and consistency. ';
  }

  if (strengths.length > 0) {
    summary += `Your strengths include ${strengths.join(', ').toLowerCase()}. `;
  }

  if (improvements.length > 0) {
    summary += `Key areas for development: ${improvements.join(', ').toLowerCase()}. `;
  }

  summary += 'Remember, the best drivers never stop learning. Keep pushing those limits safely!';

  return summary;
};