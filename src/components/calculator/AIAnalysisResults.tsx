"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Edit2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIDetectedDetails {
  buildingType: string;
  visibleFloors: number | '';
  mainEntrance: number | '';
  visibleWindows: number | '';
  hasBalcony: boolean;
  roofStyle: string;
  hasCompoundWall: boolean;
}

interface AIAnalysisResultsProps {
  images: File[];
  onConfirm: (details: AIDetectedDetails) => void;
}

export function AIAnalysisResults({ images, onConfirm }: AIAnalysisResultsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [details, setDetails] = useState<AIDetectedDetails>({
    buildingType: 'Two-floor House',
    visibleFloors: 2,
    mainEntrance: 1,
    visibleWindows: 6,
    hasBalcony: true,
    roofStyle: 'Flat Terrace',
    hasCompoundWall: false,
  });

  useEffect(() => {
    // Simulate AI analysis delay
    const timer = setTimeout(() => {
      setIsAnalyzing(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (field: keyof AIDetectedDetails, value: string | number | boolean) => {
    setDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    onConfirm(details);
  };

  if (isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-12 w-12 text-orange-600 animate-spin mb-4" />
        <h3 className="text-xl font-medium text-gray-900">AI is analyzing your images...</h3>
        <p className="text-gray-500 mt-2 text-center max-w-md">
          Identifying building type, floors, doors, windows, and other visible structural elements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6 border-b pb-4">
        <CheckCircle2 className="h-6 w-6 text-green-500" />
        <h2 className="text-2xl font-bold text-gray-900">AI Detected Details</h2>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <Info className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              Please review the details below. AI detection is an approximation. You can manually edit these values to improve the initial 3D model generation.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Building Type</label>
          <select
            value={details.buildingType}
            onChange={(e) => handleChange('buildingType', e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"
          >
            <option>House</option>
            <option>Two-floor House</option>
            <option>Villa</option>
            <option>Shop</option>
            <option>Small Commercial Building</option>
            <option>Compound Wall</option>
            <option>Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Visible Floors</label>
          <input
            type="number"
            min="1"
            max="10"
            value={details.visibleFloors}
            onChange={(e) => handleChange('visibleFloors', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Approximate Doors / Main Entrances</label>
          <input
            type="number"
            min="0"
            value={details.mainEntrance}
            onChange={(e) => handleChange('mainEntrance', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Visible Windows</label>
          <input
            type="number"
            min="0"
            value={details.visibleWindows}
            onChange={(e) => handleChange('visibleWindows', e.target.value === '' ? '' : parseInt(e.target.value))}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Balcony Presence</label>
          <div className="mt-2 flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={details.hasBalcony}
                onChange={() => handleChange('hasBalcony', true)}
                className="focus:ring-orange-500 h-4 w-4 text-orange-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Yes</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={!details.hasBalcony}
                onChange={() => handleChange('hasBalcony', false)}
                className="focus:ring-orange-500 h-4 w-4 text-orange-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Compound Wall Presence</label>
          <div className="mt-2 flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={details.hasCompoundWall}
                onChange={() => handleChange('hasCompoundWall', true)}
                className="focus:ring-orange-500 h-4 w-4 text-orange-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Yes</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={!details.hasCompoundWall}
                onChange={() => handleChange('hasCompoundWall', false)}
                className="focus:ring-orange-500 h-4 w-4 text-orange-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">No</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Roof Style</label>
          <select
            value={details.roofStyle}
            onChange={(e) => handleChange('roofStyle', e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm rounded-md"
          >
            <option>Flat Terrace</option>
            <option>Sloped Roof</option>
            <option>Gable Roof</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => window.location.reload()} // basic reset
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Cancel
        </button>
        <button
          onClick={handleContinue}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        >
          Confirm Details & Proceed
        </button>
      </div>
    </div>
  );
}
