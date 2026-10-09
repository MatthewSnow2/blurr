import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SessionDetailsFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: { eventName: string; driver: string; vehicle: string; }) => void;
  isSaving: boolean;
}

const SessionDetailsForm: React.FC<SessionDetailsFormProps> = ({ isOpen, onClose, onSave, isSaving }) => {
  const [eventName, setEventName] = useState('');
  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !driver.trim() || !vehicle.trim()) {
      alert('Please fill out all fields.');
      return;
    }
    onSave({ eventName, driver, vehicle });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur">
      <div className="carbon-card p-8 rounded-xl max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-chrome-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-display font-bold text-white mb-6">Save Analysis Session</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="eventName" className="block text-sm font-medium text-chrome-300 mb-1">Event Name</label>
            <input
              type="text"
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full bg-carbon-800 border border-carbon-700 text-white rounded-lg px-3 py-2 focus:ring-electric-500 focus:border-electric-500"
              placeholder="e.g., Laguna Seca Hot Lap"
              required
            />
          </div>
          <div>
            <label htmlFor="driver" className="block text-sm font-medium text-chrome-300 mb-1">Driver</label>
            <input
              type="text"
              id="driver"
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
              className="w-full bg-carbon-800 border border-carbon-700 text-white rounded-lg px-3 py-2 focus:ring-electric-500 focus:border-electric-500"
              placeholder="e.g., John Doe"
              required
            />
          </div>
          <div>
            <label htmlFor="vehicle" className="block text-sm font-medium text-chrome-300 mb-1">Vehicle</label>
            <input
              type="text"
              id="vehicle"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              className="w-full bg-carbon-800 border border-carbon-700 text-white rounded-lg px-3 py-2 focus:ring-electric-500 focus:border-electric-500"
              placeholder="e.g., Porsche 911 GT3 RS"
              required
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full chrome-button shimmer-effect px-8 py-3 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionDetailsForm;
