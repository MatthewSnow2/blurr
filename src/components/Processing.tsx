import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, ShieldCheck } from 'lucide-react';

const analysisSteps = [
  { text: 'Reading local telemetry...', icon: <Activity className="h-6 w-6" /> },
  { text: 'Checking supported file structure...', icon: <ShieldCheck className="h-6 w-6" /> },
  { text: 'Keeping video separate from evidence...', icon: <ShieldCheck className="h-6 w-6" /> },
  { text: 'Preparing grounded-report status...', icon: <ShieldCheck className="h-6 w-6" /> },
];

const Processing: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prevStep) => {
        if (prevStep >= analysisSteps.length) {
          clearInterval(interval);
          return prevStep;
        }
        return prevStep + 1;
      });
    }, 1200); // Change step every 1.2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-display font-bold text-electric-400 mb-4">Validating Local Session</h2>
        <p className="text-chrome-300 text-lg max-w-2xl mx-auto">No cloud provider is called in this checkpoint, and unverified coaching claims remain hidden.</p>
      </div>
      <div className="w-full max-w-md space-y-4">
        {analysisSteps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center space-x-4 p-4 rounded-lg transition-all duration-500 ease-in-out ${
              currentStep > index ? 'bg-green-500/10 text-green-300' : 
              currentStep === index ? 'bg-electric-500/20 text-electric-300 scale-105 shadow-lg shadow-electric-500/20' : 'bg-gray-800 text-gray-400'
            }`}
          >
            <div className={`transition-transform duration-300 ${currentStep === index ? 'animate-pulse' : ''}`}>
                {step.icon}
            </div>
            <span className="font-semibold flex-grow">{step.text}</span>
            {currentStep > index && (
                <CheckCircle className="h-6 w-6 text-green-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Processing;
