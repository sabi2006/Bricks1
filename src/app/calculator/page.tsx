"use client";

import React, { useState } from 'react';
import { motion } from "framer-motion";
import { CalculatorProvider } from "@/components/calculator/CalculatorContext";
import CalculatorSettingsPanel from "@/components/calculator/CalculatorSettings";
import ResultDashboard from "@/components/calculator/ResultDashboard";
import StructurePreview3D from "@/components/calculator/StructurePreview3D";
import { VisualEstimator } from "@/components/calculator/VisualEstimator";
import { Calculator as CalculatorIcon, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { useCalculator } from "@/components/calculator/CalculatorContext";

function CalculatorContent() {
  const { activeTab, setActiveTab } = useCalculator();

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-slate-900 text-white py-14 md:py-18">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Brick Calculator</h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
              Estimate the bricks, mortar and approximate material cost required for your construction project.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-gray-200 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('standard')}
              className={cn(
                "px-6 py-2.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2",
                activeTab === 'standard' ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalculatorIcon className="w-4 h-4" />
              <span>Standard Calculator</span>
            </button>
            <button
              onClick={() => setActiveTab('visual')}
              className={cn(
                "px-6 py-2.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2",
                activeTab === 'visual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <ImageIcon className="w-4 h-4 text-orange-500" />
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">AI Visual Estimator</span>
            </button>
          </div>
        </div>

        {activeTab === 'standard' ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2">
                <CalculatorSettingsPanel />
              </div>
              <div className="lg:col-span-1">
                <ResultDashboard />
              </div>
            </div>
            <div className="w-full mt-8">
              <StructurePreview3D />
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <VisualEstimator />
          </motion.div>
        )}

      </div>
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <CalculatorProvider>
      <CalculatorContent />
    </CalculatorProvider>
  );
}
