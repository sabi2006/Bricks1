"use client";

import React, { useState } from 'react';
import { ImageUpload } from './ImageUpload';
import { AIAnalysisResults } from './AIAnalysisResults';
import { BuildingEditor } from './BuildingEditor';
import { VisualEstimatorResults } from './VisualEstimatorResults';
import { cn } from '@/lib/utils';

export function VisualEstimator() {
  const [step, setStep] = useState(1);
  const [aiDetails] = useState<any>({
    buildingType: 'Two-floor House',
    visibleFloors: 2,
    mainEntrance: 1,
    visibleWindows: 6,
    hasBalcony: true,
    roofStyle: 'Flat Terrace',
    hasCompoundWall: false,
  });

  const handleGenerate = () => {
    setStep(2);
  };

  return (
    <div className="w-full max-w-7xl mx-auto py-6 sm:py-8">
      {/* Sub-navigation Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6 shadow-sm border border-gray-200">
        <button
          onClick={() => setStep(1)}
          className={cn(
            "flex-1 py-2.5 text-sm font-bold rounded-md text-center transition-all",
            step === 1 ? "bg-white text-orange-600 shadow" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          Step 1: Interactive Wall Editor
        </button>
        <button
          onClick={() => setStep(2)}
          className={cn(
            "flex-1 py-2.5 text-sm font-bold rounded-md text-center transition-all",
            step === 2 ? "bg-white text-orange-600 shadow" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          )}
        >
          Step 2: Comprehensive AI Estimate
        </button>
      </div>

      {/* Content */}
      <div className="w-full bg-white shadow rounded-lg p-4 sm:p-6 border border-gray-200">
        {step === 1 && <BuildingEditor initialDetails={aiDetails} onGenerate={handleGenerate} />}
        {step === 2 && <VisualEstimatorResults onBack={() => setStep(1)} />}
      </div>
    </div>
  );
}
