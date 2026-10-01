"use client";

import React, { useState, useMemo } from 'react';
import { useCalculator } from './CalculatorContext';
import { Download, Share2, Phone, AlertTriangle, ArrowLeft, Info, FileText, Loader2, LandPlot, ShieldAlert, Save, FolderClock, Paintbrush } from 'lucide-react';
import { VisualEstimator3D } from '../3d/VisualEstimator3D';
import { SaveProjectModal } from './SaveProjectModal';
import { ProjectHistoryModal } from './ProjectHistoryModal';

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
    <path d="M11.99 0C5.367 0 0 5.366 0 11.99c0 2.12.553 4.17 1.603 5.986L.045 24l6.195-1.624C8.01 23.336 9.974 23.98 11.99 23.98 18.614 23.98 24 18.614 24 11.99 24 5.366 18.614 0 11.99 0zm0 21.986c-1.802 0-3.567-.483-5.113-1.397l-.367-.216-3.805.998.997-3.708-.237-.378C2.518 15.698 1.993 13.86 1.993 11.99 1.993 6.467 6.467 1.993 11.99 1.993 17.514 1.993 22.007 6.468 22.007 11.99c0 5.522-4.493 9.996-10.017 9.996zm5.495-7.483c-.302-.15-1.787-.882-2.062-.983-.275-.1-.475-.15-.675.15s-.775.983-.95 1.183c-.175.2-.35.225-.65.075-2.008-1-3.64-2.825-4.225-3.833-.175-.3-.025-.462.125-.612.133-.133.302-.35.452-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.242-.584-.488-.505-.675-.514-.175-.008-.375-.008-.575-.008-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.113 3.225 5.113 4.525.713.313 1.263.5 1.7.638.712.225 1.362.187 1.875.112.575-.087 1.787-.725 2.037-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
  </svg>
);
import { calculateProject, calculateWallMetrics, toSqMeters, CalculatorSettings, Unit, BuildingModel, DEFAULT_PLASTER_CONFIG } from '@/lib/brickCalculator';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface VisualEstimatorResultsProps {
  onBack?: () => void;
}

export function VisualEstimatorResults({ onBack }: VisualEstimatorResultsProps) {
  const { buildingModel, brickType, settings, setActiveTab, result, projectName, setBuildingModel } = useCalculator();
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Apply standard plaster helper (12mm inner, 15mm outer, 6mm RCC)
  const handleApplyStandardPlaster = () => {
    if (!buildingModel) return;
    const updatedModel: BuildingModel = {
      ...buildingModel,
      plaster: {
        ...(buildingModel.plaster || DEFAULT_PLASTER_CONFIG),
        enabled: true,
        targetSurface: 'both',
        targetWallFace: 'both',
        useCommonInnerSettings: true,
        useCommonOuterSettings: true,
        inner: {
          ...(buildingModel.plaster?.inner || DEFAULT_PLASTER_CONFIG.inner),
          enabled: true,
          thickness: 12,
          thicknessMm: 12,
          mixRatio: '1:6',
        },
        outer: {
          ...(buildingModel.plaster?.outer || DEFAULT_PLASTER_CONFIG.outer),
          enabled: true,
          thickness: 15,
          thicknessMm: 15,
          mixRatio: '1:4',
        },
        rcc: {
          ...(buildingModel.plaster?.rcc || DEFAULT_PLASTER_CONFIG.rcc),
          enabled: true,
          thickness: 6,
          thicknessMm: 6,
          mixRatio: '1:4',
        },
        rccSideBeam: {
          ...(buildingModel.plaster?.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam),
          enabled: true,
          thickness: 6,
          thicknessMm: 6,
          mixRatio: '1:4',
        },
      },
      floors: buildingModel.floors.map(f => ({
        ...f,
        plaster: {
          ...(f.plaster || DEFAULT_PLASTER_CONFIG),
          enabled: true,
          inner: { ...(f.plaster?.inner || DEFAULT_PLASTER_CONFIG.inner), enabled: true, thickness: 12, thicknessMm: 12, mixRatio: '1:6' },
          outer: { ...(f.plaster?.outer || DEFAULT_PLASTER_CONFIG.outer), enabled: true, thickness: 15, thicknessMm: 15, mixRatio: '1:4' },
          rcc: { ...(f.plaster?.rcc || DEFAULT_PLASTER_CONFIG.rcc), enabled: true, thickness: 6, thicknessMm: 6, mixRatio: '1:4' },
          rccSideBeam: { ...(f.plaster?.rccSideBeam || DEFAULT_PLASTER_CONFIG.rccSideBeam), enabled: true, thickness: 6, thicknessMm: 6, mixRatio: '1:4' },
        },
        externalWalls: (f.externalWalls || []).map(w => ({
          ...w,
          plasterOverrides: {
            inner: { enabled: true, thicknessMm: 12, mixRatio: '1:6' },
            outer: { enabled: true, thicknessMm: 15, mixRatio: '1:4' },
          }
        })),
        internalWalls: (f.internalWalls || []).map(w => ({
          ...w,
          plasterOverrides: {
            inner: { enabled: true, thicknessMm: 12, mixRatio: '1:6' },
            outer: { enabled: false, thicknessMm: 15, mixRatio: '1:4' },
          }
        }))
      }))
    };
    setBuildingModel(updatedModel);
  };

  // Local Editable States for Calculation
  const [wastagePercent, setWastagePercent] = useState<number>(settings.wastagePercentage || 5);
  const [mortarRatio, setMortarRatio] = useState<string>('1:5'); // Cement:Sand
  const [brickPrice, setBrickPrice] = useState<number>(settings.brickPrice || 8.5);
  const [cementPrice, setCementPrice] = useState<number>(settings.cementPrice || 400);
  const [sandPrice, setSandPrice] = useState<number>(
    settings.sandPricePerCft !== undefined 
      ? settings.sandPricePerCft 
      : (settings.sandPrice && settings.sandPrice <= 200 ? settings.sandPrice : 60)
  ); // per CFT
  const [sandUnit, setSandUnit] = useState<'CFT' | 'm³'>('CFT');

  // Labour States
  const [masonProductivity, setMasonProductivity] = useState<number>(500); // bricks per day
  const [helperProductivity, setHelperProductivity] = useState<number>(700);
  const [masonWage, setMasonWage] = useState<number>(800); // ₹ per day
  const [helperWage, setHelperWage] = useState<number>(500); // ₹ per day
  const [masonCount, setMasonCount] = useState<number>(2);
  const [helperCount, setHelperCount] = useState<number>(2);

  // Extra Costs
  const [transportCost, setTransportCost] = useState<number>(settings.transportCost || 0);
  const [contingencyPercent, setContingencyPercent] = useState<number>(0);

  // RCC Pillar specific states
  const [aggregatePrice, setAggregatePrice] = useState<number>(
    settings.aggregatePricePerCft !== undefined 
      ? settings.aggregatePricePerCft 
      : (settings.aggregatePrice && settings.aggregatePrice <= 200 ? settings.aggregatePrice : 45)
  ); // ₹ per CFT
  const [rccMixRatio, setRccMixRatio] = useState<'1:1.5:3' | '1:2:4' | '1:3:6' | 'custom'>('1:1.5:3');
  const [rccLabourRate, setRccLabourRate] = useState<number>(settings.rccLabourRate || 4000); // per m3
  const [steelRate, setSteelRate] = useState<number>(settings.steelRate || 65); // per kg

  // Foundation specific rate states
  const [excavationRate, setExcavationRate] = useState<number>(settings.excavationRatePerM3 || 250); // ₹ per m3
  const [sandFillRate, setSandFillRate] = useState<number>(settings.sandFillRatePerCft || 45); // ₹ per CFT
  const [pccLabourRate, setPccLabourRate] = useState<number>(settings.pccLabourRatePerM3 || 2500); // ₹ per m3
  const [footingLabourRate, setFootingLabourRate] = useState<number>(settings.footingLabourRatePerM3 || 4200); // ₹ per m3

  // Compute Results dynamically based on local state
  const computedResult = useMemo(() => {
    if (!buildingModel || !brickType) return null;

    const [cementR, sandR] = mortarRatio.split(':').map(Number);
    
    const localSettings: CalculatorSettings = {
      ...settings,
      wastagePercentage: wastagePercent,
      mixRatioCement: cementR,
      mixRatioSand: sandR,
      brickPrice: brickPrice,
      cementPrice: cementPrice,
      // The sand price in context is per m3, we might need to convert if user entered CFT
      sandPrice: sandUnit === 'CFT' ? sandPrice * 35.3147 : sandPrice, 
      sandPricePerCft: sandUnit === 'CFT' ? sandPrice : sandPrice / 35.3147,
      labourCost: 0,
      transportCost: transportCost,
      
      // RCC Material settings (direct rate binding with unit consistency)
      rccConcreteMixRatio: rccMixRatio,
      rccCementRatio: Number(rccMixRatio.split(':')[0]) || 1,
      rccSandRatio: Number(rccMixRatio.split(':')[1]) || 1.5,
      rccAggregateRatio: Number(rccMixRatio.split(':')[2]) || 3,
      aggregatePrice: aggregatePrice,
      aggregatePricePerCft: aggregatePrice, // User input in ₹ / CFT
      rccLabourRate: rccLabourRate,
      steelRate: steelRate,

      // Foundation settings
      excavationRatePerM3: excavationRate,
      sandFillRatePerCft: sandFillRate,
      pccLabourRatePerM3: pccLabourRate,
      footingLabourRatePerM3: footingLabourRate
    };

    return calculateProject({ walls: [], pillars: buildingModel.pillars || [], buildingModel }, brickType, localSettings);
  }, [buildingModel, brickType, settings, wastagePercent, mortarRatio, brickPrice, cementPrice, sandPrice, sandUnit, transportCost, rccMixRatio, aggregatePrice, steelRate, rccLabourRate, excavationRate, sandFillRate, pccLabourRate, footingLabourRate]);

  // Wall Area Breakdown Calculation
  const breakdown = useMemo(() => {
    if (!buildingModel || !computedResult) return null;
    
    let extGross = 0, extOp = 0, extNet = 0, extVol = 0;
    let intGross = 0, intOp = 0, intNet = 0, intVol = 0;

    buildingModel.floors.forEach(floor => {
      floor.externalWalls.forEach(wall => {
        const m = calculateWallMetrics(wall);
        extGross += m.grossArea; extOp += m.openingArea; extNet += m.netArea; extVol += m.netVolume;
      });
      floor.internalWalls.forEach(wall => {
        const m = calculateWallMetrics(wall);
        intGross += m.grossArea; intOp += m.openingArea; intNet += m.netArea; intVol += m.netVolume;
      });
    });

    const calcBricks = (vol: number) => Math.ceil(vol / computedResult.effectiveBrickVolume);

    return {
      external: { gross: extGross, op: extOp, net: extNet, bricks: calcBricks(extVol) },
      internal: { gross: intGross, op: intOp, net: intNet, bricks: calcBricks(intVol) },
      total: { 
        gross: extGross + intGross, 
        op: extOp + intOp, 
        net: extNet + intNet, 
        bricks: calcBricks(extVol + intVol) 
      }
    };
  }, [buildingModel, computedResult]);

  if (!brickType || !brickType.productId) {
    return (
      <div className="bg-red-50 p-6 rounded-xl border border-red-200 flex flex-col items-center justify-center space-y-4 text-center">
        <AlertTriangle className="h-10 w-10 text-red-500" />
        <div>
          <h3 className="text-lg font-bold text-red-900">Missing Brick Specification</h3>
          <p className="text-red-700 mt-2">Please select an A V M Bricks product in the Standard Calculator before generating the estimate.</p>
        </div>
        <button 
          onClick={() => setActiveTab('standard')}
          className="mt-4 px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          Go to Standard Calculator
        </button>
      </div>
    );
  }

  if (!computedResult || !breakdown) return null;

  // Labour Calculations
  const masonDays = Math.ceil(computedResult.baseBrickQuantity / masonProductivity);
  const helperDays = Math.ceil(computedResult.baseBrickQuantity / helperProductivity);
  const masonCost = masonDays * masonWage;
  const helperCost = helperDays * helperWage;
  const totalLabourCost = masonCost + helperCost;
  
  // Cost Calculations
  const materialCost = computedResult.costs.total; // Excludes labour, includes transport from localSettings
  const rccTotal = computedResult.rccProjectEstimate?.costs.total || 0;
  const foundationTotal = computedResult.foundationEstimate?.costs.total || 0;
  const plasterTotal = computedResult.plasterEstimate?.costs.total || 0;
  
  const totalBaseWorks = materialCost + totalLabourCost + rccTotal + foundationTotal + plasterTotal;
  const contingencyAmount = totalBaseWorks * (contingencyPercent / 100);
  const grandTotal = totalBaseWorks + transportCost + contingencyAmount;

  const handleWhatsapp = () => {
    setIsWhatsappLoading(true);
    const msg = `Hello A V M Bricks, I need a quote.

Project Type: AI Visual Estimate
Estimated Bricks: ${computedResult.totalBricks.toLocaleString()}
Selected Brick: ${brickType.name}
Estimated Material Cost: ₹${Math.round(grandTotal).toLocaleString('en-IN')}

Please contact me.`;

    setTimeout(() => {
      window.open(`https://wa.me/919791316101?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      setIsWhatsappLoading(false);
    }, 400);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50 transition-colors" title="Back to Editor">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900">Comprehensive AI Building Estimate</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button 
            onClick={() => setIsSaveModalOpen(true)} 
            className="inline-flex items-center px-4 py-2 border border-orange-500 rounded-md shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors"
          >
            <Save className="h-4 w-4 mr-2" /> Save to History
          </button>
          <button 
            onClick={() => setIsHistoryModalOpen(true)} 
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <FolderClock className="h-4 w-4 mr-2 text-orange-600" /> History
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Download className="h-4 w-4 mr-2 text-gray-500" /> Print / PDF
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Share2 className="h-4 w-4 mr-2 text-gray-500" /> Share
          </button>
        </div>
      </div>

      {/* Synchronization Confirmation Card */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange-200/50 pb-4 mb-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Single Source of Truth</span>
            <h3 className="text-lg font-bold text-slate-900">Using Your Selected {brickType.supplierBrand || 'A V M Bricks'} Specification</h3>
          </div>
          <button 
            onClick={() => setActiveTab('standard')}
            className="px-4 py-2 bg-white text-orange-700 border border-orange-300 rounded-lg text-sm font-semibold hover:bg-orange-50 transition-colors shadow-sm whitespace-nowrap"
          >
            Edit Brick Selection
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">Brick Name</p>
            <p className="text-sm font-bold text-slate-900">{brickType.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">Brick Size</p>
            <p className="text-sm font-bold text-slate-900">{brickType.length} × {brickType.width} × {brickType.height} mm</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">Design & Color</p>
            <p className="text-sm font-bold text-slate-900">{brickType.brickDesign || 'Standard'} • {brickType.brickColor || 'Natural'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">Mortar Joint</p>
            <p className="text-sm font-bold text-slate-900">{settings.mortarJointHorizontal}mm Horizontal</p>
          </div>
        </div>
      </div>

      {/* 3D Preview Component */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-slate-200">
        <VisualEstimator3D model={buildingModel!} />
      </div>

      {/* 1. Wall Area Breakdown */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center"><FileText className="w-5 h-5 mr-2 text-orange-600" /> Wall Area Breakdown</h3>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="text-gray-500 text-left font-medium tracking-wider text-xs uppercase">
                <th className="pb-3 pr-4">Section</th>
                <th className="pb-3 px-4 text-right">Gross Area (m²)</th>
                <th className="pb-3 px-4 text-right">Opening Deduction (m²)</th>
                <th className="pb-3 px-4 text-right">Net Area (m²)</th>
                <th className="pb-3 pl-4 text-right">Base Bricks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              <tr>
                <td className="py-3 pr-4 font-medium">External Walls</td>
                <td className="py-3 px-4 text-right">{breakdown.external.gross.toFixed(2)}</td>
                <td className="py-3 px-4 text-right">{breakdown.external.op.toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-semibold text-gray-900">{breakdown.external.net.toFixed(2)}</td>
                <td className="py-3 pl-4 text-right">{breakdown.external.bricks.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-medium">Internal Walls</td>
                <td className="py-3 px-4 text-right">{breakdown.internal.gross.toFixed(2)}</td>
                <td className="py-3 px-4 text-right">{breakdown.internal.op.toFixed(2)}</td>
                <td className="py-3 px-4 text-right font-semibold text-gray-900">{breakdown.internal.net.toFixed(2)}</td>
                <td className="py-3 pl-4 text-right">{breakdown.internal.bricks.toLocaleString()}</td>
              </tr>
              <tr className="bg-gray-50 font-bold text-gray-900">
                <td className="py-3 pr-4 border-t border-gray-200">Total</td>
                <td className="py-3 px-4 text-right border-t border-gray-200">{breakdown.total.gross.toFixed(2)}</td>
                <td className="py-3 px-4 text-right border-t border-gray-200">{breakdown.total.op.toFixed(2)}</td>
                <td className="py-3 px-4 text-right border-t border-gray-200">{breakdown.total.net.toFixed(2)}</td>
                <td className="py-3 pl-4 text-right border-t border-gray-200 text-orange-600">{breakdown.total.bricks.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 2 & 3. Materials Estimate Grid */}
      <div className="space-y-6">
        
        {/* Brick Masonry Construction Estimate */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-5 border-b border-orange-700 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2.5">
                <span className="text-2xl">🧱</span> Brick Masonry Construction Estimate
              </h3>
              <p className="text-xs text-orange-100 mt-1">
                Standard TN Red Brick ({brickType.length || 230} × {brickType.width || 115} × {brickType.height || 75} mm) volume-based calculation with mortar and wastage.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="bg-white/20 text-white border border-white/30 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                {computedResult.purchaseBrickQuantity.toLocaleString()} Bricks ({computedResult.baseBrickQuantity.toLocaleString()} Base)
              </span>
              <span className="bg-white/20 text-white border border-white/30 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                Brick Cost: ₹{Math.round(computedResult.costs.bricks).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Multi-Floor Brick Breakdown (if buildingModel with floors) */}
            {computedResult.floorMasonryEstimates && computedResult.floorMasonryEstimates.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>🏢 Floor-by-Floor Brick Masonry Breakdown</span>
                  <span className="text-slate-400 font-normal">({computedResult.floorMasonryEstimates.length} {computedResult.floorMasonryEstimates.length === 1 ? 'Floor' : 'Floors'})</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Floor</th>
                        <th className="py-2.5 px-4 text-right">Net Wall Vol (CFT)</th>
                        <th className="py-2.5 px-4 text-right">Base Bricks</th>
                        <th className="py-2.5 px-4 text-right">Wastage</th>
                        <th className="py-2.5 px-4 text-right font-bold text-orange-700">Purchase Bricks</th>
                        <th className="py-2.5 px-4 text-right">Price / Brick</th>
                        <th className="py-2.5 px-4 text-right">Brick Cost (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {computedResult.floorMasonryEstimates.map(fl => (
                        <tr key={fl.floorId}>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{fl.floorName} (L{fl.floorLevel})</td>
                          <td className="py-2.5 px-4 text-right font-mono">{(fl.netWallVolume * 35.3147).toFixed(1)} CFT</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fl.baseBrickQuantity.toLocaleString()} Nos</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">+{fl.wastageBricks.toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{fl.purchaseBrickQuantity.toLocaleString()} Nos</td>
                          <td className="py-2.5 px-4 text-right font-mono">₹{brickPrice}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fl.brickCost).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-300">
                        <td className="py-3 px-4">Total Masonry</td>
                        <td className="py-3 px-4 text-right font-mono">{(computedResult.netWallVolume * 35.3147).toFixed(1)} CFT</td>
                        <td className="py-3 px-4 text-right font-mono">{computedResult.baseBrickQuantity.toLocaleString()} Nos</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">+{computedResult.wastageBricks.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-orange-600 text-sm">{computedResult.purchaseBrickQuantity.toLocaleString()} Nos</td>
                        <td className="py-3 px-4 text-right font-mono">₹{brickPrice}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-orange-600 text-sm">₹{Math.round(computedResult.costs.bricks).toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Calculations and Editable Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Order Quantity Box */}
              <div className="bg-orange-50/60 p-5 rounded-xl border border-orange-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-orange-800 uppercase tracking-wider block mb-2">Brick Order Summary</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>Base Calculated:</span>
                      <span className="font-mono font-bold">{computedResult.baseBrickQuantityExact ? computedResult.baseBrickQuantityExact.toFixed(2) : computedResult.baseBrickQuantity} Nos</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Wastage Allowance ({wastagePercent}%):</span>
                      <span className="font-mono font-bold">+{computedResult.wastageBricks} Nos</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>Final Calculated:</span>
                      <span className="font-mono font-bold">{computedResult.finalBrickQuantityExact ? computedResult.finalBrickQuantityExact.toFixed(2) : computedResult.totalBricks} Nos</span>
                    </div>
                    <div className="pt-2 border-t border-orange-200 flex justify-between items-end">
                      <div>
                        <span className="text-[11px] text-orange-900 font-bold uppercase block">Purchase Quantity</span>
                        <span className="text-2xl font-extrabold text-orange-600 font-mono">{computedResult.purchaseBrickQuantity.toLocaleString()}</span>
                        <span className="text-xs text-orange-900 font-medium ml-1">bricks</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Total Brick Cost</span>
                        <span className="text-xl font-bold text-slate-900 font-mono">₹{Math.round(computedResult.costs.bricks).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Brick Price & Wastage Settings */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">⚙️ Brick Price & Wastage</span>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Red Brick Price / Piece (₹)</label>
                    <input 
                      type="number" 
                      step="0.25" 
                      value={brickPrice} 
                      onChange={e => setBrickPrice(Number(e.target.value))} 
                      className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900 font-bold" 
                      placeholder="e.g. 8.5"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Wastage Percentage (%)</label>
                    <select 
                      value={wastagePercent} 
                      onChange={e => setWastagePercent(Number(e.target.value))} 
                      className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-medium text-slate-900"
                    >
                      <option value={3}>3% (Minimal cutting loss)</option>
                      <option value={5}>5% (Standard construction)</option>
                      <option value={7}>7% (Complex layouts)</option>
                      <option value={10}>10% (High tolerance)</option>
                    </select>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1">
                    Default TN Red Brick: <b>230 × 115 × 75 mm</b>
                  </div>
                </div>
              </div>

              {/* Mortar Materials Box */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">🧱 Wall Mortar Materials</span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Mortar Cement:</span>
                    <span className="font-mono font-bold text-slate-900">{computedResult.cementBags} Bags (50kg)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Mortar Sand:</span>
                    <span className="font-mono font-bold text-slate-900">{sandUnit === 'CFT' ? (computedResult.sandVolume * 35.3147).toFixed(1) : computedResult.sandVolume.toFixed(2)} {sandUnit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Mortar Joint:</span>
                    <span className="font-mono text-slate-700">{settings.mortarJointHorizontal || 10}mm</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Cement (₹/bag)</label>
                      <input 
                        type="number" 
                        value={cementPrice} 
                        onChange={e => setCementPrice(Number(e.target.value))} 
                        className="w-full px-2 py-1 border border-slate-300 bg-white rounded text-xs font-mono" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Sand (₹/{sandUnit})</label>
                      <input 
                        type="number" 
                        value={sandPrice} 
                        onChange={e => setSandPrice(Number(e.target.value))} 
                        className="w-full px-2 py-1 border border-slate-300 bg-white rounded text-xs font-mono" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2b. DEDICATED PLASTER / CEMENT FINISH ESTIMATE (Immediately follows Brick Masonry, Requirement 42) */}
      {(() => {
        const plEst = computedResult.plasterEstimate;
        const isPlasterApplied = plEst && plEst.totalNetPlasterAreaSqFt > 0;

        // If plaster is not applied yet, show clear status card with quick apply and customize buttons
        if (!isPlasterApplied) {
          return (
            <div className="bg-gradient-to-br from-teal-950/10 via-slate-900/5 to-teal-900/10 rounded-2xl shadow-md border border-teal-200/80 overflow-hidden mt-8 p-6 transition-all hover:shadow-lg">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🎨</span>
                    <h3 className="text-xl font-bold text-slate-900">
                      Plaster &amp; Cement Finish Estimate
                    </h3>
                    <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      Status: Not Applied (0 sq.ft)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                    Cement plaster finish (12mm Inner Masonry, 15mm Outer Masonry, 6mm RCC Columns &amp; Side Beams) has not been applied to this building yet. When enabled, plaster accurately calculates cement bags and fine sand without altering wall brickwork or beam geometry.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleApplyStandardPlaster}
                    className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/20 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>Apply Standard Plaster (12mm + 15mm + 6mm Column &amp; Side Beam)</span>
                  </button>
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Paintbrush className="w-3.5 h-3.5 text-teal-600" />
                      <span>Open Plaster Editor</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // When plaster IS applied
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-teal-200/80 overflow-hidden mt-8 transition-all hover:shadow-2xl">
            {/* Header with gradient badge */}
            <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 px-6 py-5 border-b border-teal-800/60 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <span className="text-2xl">🎨</span> Live Plaster &amp; Cement Finish Estimate
                </h3>
                <p className="text-xs text-teal-200/90 mt-1">
                  Layer-by-layer surface estimation: Inner Masonry (12mm, 1:6) + Outer Masonry (15mm, 1:4) + RCC Columns &amp; Side Beams (6mm, 1:4) with opening deductions (IS 1200 Part XII).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                  {plEst.totalNetPlasterAreaSqFt.toFixed(1)} sq.ft ({plEst.totalNetPlasterAreaSqM.toFixed(1)} m²)
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                  Plaster Cost: ₹{Math.round(plEst.costs.total).toLocaleString('en-IN')}
                </span>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="px-3 py-1.5 bg-teal-800/80 hover:bg-teal-700 text-teal-100 border border-teal-600/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    <span>Edit Plaster</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Layer Highlights Grid (8 cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
                <div className="p-2.5 bg-teal-50/70 border border-teal-200/70 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-teal-800 block">📐 Total Plaster Area</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{plEst.totalNetPlasterAreaSqFt.toFixed(1)} sq.ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({plEst.totalNetPlasterAreaSqM.toFixed(1)} m²)</span>
                </div>
                <div className="p-2.5 bg-teal-50/70 border border-teal-200/70 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-teal-800 block">🏠 Inner Plaster</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{plEst.inner.netAreaSqFt.toFixed(1)} sq.ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({plEst.inner.thicknessMm}mm • {plEst.inner.mixRatio})</span>
                </div>
                <div className="p-2.5 bg-sky-50/70 border border-sky-200/70 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-sky-800 block">🌤️ Outer Plaster</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{plEst.outer.netAreaSqFt.toFixed(1)} sq.ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({plEst.outer.thicknessMm}mm • {plEst.outer.mixRatio})</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-700 block">🏛️ RCC Columns</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{plEst.rcc.netAreaSqFt.toFixed(1)} sq.ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({plEst.rcc.thicknessMm}mm • {plEst.rcc.mixRatio})</span>
                </div>
                <div className="p-2.5 bg-amber-50/50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-900 block">🏗️ Side Beams</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{plEst.rccSideBeam.netAreaSqFt.toFixed(1)} sq.ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({plEst.rccSideBeam.thicknessMm}mm • {plEst.rccSideBeam.mixRatio})</span>
                </div>
                <div className="p-2.5 bg-teal-100/70 border border-teal-300 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-teal-950 block">📦 Plaster Cement</span>
                  <span className="font-bold text-teal-900 font-mono text-sm block mt-1">{plEst.totalCementBags.toFixed(1)} Bags</span>
                  <span className="text-[10px] text-teal-700 font-mono">(50 kg bags)</span>
                </div>
                <div className="p-2.5 bg-amber-50/70 border border-amber-300 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-900 block">🏖️ Plaster Sand</span>
                  <span className="font-bold text-amber-900 font-mono text-sm block mt-1">{plEst.totalSandCft.toFixed(1)} CFT</span>
                  <span className="text-[10px] text-amber-700 font-mono">({plEst.totalSandM3.toFixed(2)} m³ • No Jalli)</span>
                </div>
                <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-800 block">💧 Curing Water</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{plEst.totalWaterLitres.toFixed(0)} L</span>
                  <span className="text-[10px] text-slate-500 font-mono">(~28 L/bag)</span>
                </div>
              </div>

              {/* Requirement 44, 45, 46 & New Feature: Four Detailed Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Inner Plaster (Requirement 44) */}
                <div className="p-5 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/50 via-white to-teal-50/30 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏠</span>
                        <h4 className="font-bold text-slate-900 text-sm">Inner Masonry Plaster</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">
                        {plEst.inner.thicknessMm} mm • {plEst.inner.mixRatio}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Gross Surface Area:</span>
                        <span className="font-mono font-medium">{plEst.inner.grossAreaSqFt.toFixed(1)} sq.ft</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Opening Deductions:</span>
                        <span className="font-mono text-rose-600 font-medium">-{plEst.inner.openingDeductionSqFt.toFixed(1)} sq.ft</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-semibold text-slate-800">Net Plaster Area:</span>
                        <span className="font-mono font-bold text-teal-800">{plEst.inner.netAreaSqFt.toFixed(1)} sq.ft ({plEst.inner.netAreaSqM.toFixed(1)} m²)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Wet Mortar Volume:</span>
                        <span className="font-mono font-medium">{plEst.inner.wetVolumeM3.toFixed(2)} m³</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Plaster Cement:</span>
                        <span className="font-mono font-bold text-teal-700">{plEst.inner.cementBags.toFixed(1)} Bags (50kg)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Plaster Sand:</span>
                        <span className="font-mono font-bold text-amber-700">{plEst.inner.sandCft.toFixed(1)} CFT ({plEst.inner.sandM3.toFixed(2)} m³)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-teal-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Inner Layer Cost:</span>
                    <span className="text-sm font-bold font-mono text-teal-900">₹{Math.round(plEst.inner.costs.total).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Card 2: Outer Plaster (Requirement 45) */}
                <div className="p-5 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🌤️</span>
                        <h4 className="font-bold text-slate-900 text-sm">Outer Masonry Plaster</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                        {plEst.outer.thicknessMm} mm • {plEst.outer.mixRatio}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Gross Surface Area:</span>
                        <span className="font-mono font-medium">{plEst.outer.grossAreaSqFt.toFixed(1)} sq.ft</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Opening Deductions:</span>
                        <span className="font-mono text-rose-600 font-medium">-{plEst.outer.openingDeductionSqFt.toFixed(1)} sq.ft</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-semibold text-slate-800">Net Plaster Area:</span>
                        <span className="font-mono font-bold text-sky-800">{plEst.outer.netAreaSqFt.toFixed(1)} sq.ft ({plEst.outer.netAreaSqM.toFixed(1)} m²)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Wet Mortar Volume:</span>
                        <span className="font-mono font-medium">{plEst.outer.wetVolumeM3.toFixed(2)} m³</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Plaster Cement:</span>
                        <span className="font-mono font-bold text-sky-700">{plEst.outer.cementBags.toFixed(1)} Bags (50kg)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Plaster Sand:</span>
                        <span className="font-mono font-bold text-amber-700">{plEst.outer.sandCft.toFixed(1)} CFT ({plEst.outer.sandM3.toFixed(2)} m³)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Outer Layer Cost:</span>
                    <span className="text-sm font-bold font-mono text-sky-900">₹{Math.round(plEst.outer.costs.total).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Card 3: RCC Column Plaster (Requirement 46) */}
                <div className="p-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/50 via-white to-slate-50/30 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏛️</span>
                        <h4 className="font-bold text-slate-900 text-sm">RCC Column Plaster</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                        {plEst.rcc.thicknessMm} mm • {plEst.rcc.mixRatio}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Exposed RCC Faces:</span>
                        <span className="font-mono font-medium">Pillars &amp; Columns</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Opening Deductions:</span>
                        <span className="font-mono text-slate-400">—</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-semibold text-slate-800">Net Plaster Area:</span>
                        <span className="font-mono font-bold text-slate-800">{plEst.rcc.netAreaSqFt.toFixed(1)} sq.ft ({plEst.rcc.netAreaSqM.toFixed(1)} m²)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Wet Mortar Volume:</span>
                        <span className="font-mono font-medium">{plEst.rcc.wetVolumeM3.toFixed(2)} m³</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Plaster Cement:</span>
                        <span className="font-mono font-bold text-slate-700">{plEst.rcc.cementBags.toFixed(1)} Bags (50kg)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Plaster Sand:</span>
                        <span className="font-mono font-bold text-amber-700">{plEst.rcc.sandCft.toFixed(1)} CFT ({plEst.rcc.sandM3.toFixed(2)} m³)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Column Plaster Cost:</span>
                    <span className="text-sm font-bold font-mono text-slate-900">₹{Math.round(plEst.rcc.costs.total).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Card 4: RCC Side Beam Plaster */}
                <div className="p-5 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏗️</span>
                        <h4 className="font-bold text-slate-900 text-sm">RCC Side Beam Plaster</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {plEst.rccSideBeam.thicknessMm} mm • {plEst.rccSideBeam.mixRatio}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs text-slate-700">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Exposed Beam Faces:</span>
                        <span className="font-mono font-medium">Both Side Faces (Excl. Top/Soffit)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Opening Deductions:</span>
                        <span className="font-mono text-slate-400">—</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="font-semibold text-slate-800">Net Plaster Area:</span>
                        <span className="font-mono font-bold text-amber-900">{plEst.rccSideBeam.netAreaSqFt.toFixed(1)} sq.ft ({plEst.rccSideBeam.netAreaSqM.toFixed(1)} m²)</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Wet Mortar Volume:</span>
                        <span className="font-mono font-medium">{plEst.rccSideBeam.wetVolumeM3.toFixed(2)} m³</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Plaster Cement:</span>
                        <span className="font-mono font-bold text-amber-800">{plEst.rccSideBeam.cementBags.toFixed(1)} Bags (50kg)</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Plaster Sand:</span>
                        <span className="font-mono font-bold text-amber-700">{plEst.rccSideBeam.sandCft.toFixed(1)} CFT ({plEst.rccSideBeam.sandM3.toFixed(2)} m³)</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Side Beam Plaster Cost:</span>
                    <span className="text-sm font-bold font-mono text-amber-900">₹{Math.round(plEst.rccSideBeam.costs.total).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Requirement 43: Bill of Quantities (BOQ) Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>📜 Requirement 43: Plaster Bill of Quantities (BOQ) Schedule</span>
                  <span className="text-teal-700 font-semibold text-[11px]">IS 1200 Part XII Method of Measurement</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-4 text-left">BOQ Item Description</th>
                        <th className="py-2.5 px-4 text-right">Quantity</th>
                        <th className="py-2.5 px-4 text-center">Unit</th>
                        <th className="py-2.5 px-4 text-right">Unit Rate (₹)</th>
                        <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      <tr>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block">Inner Masonry Cement Plaster</span>
                          <span className="text-[11px] text-slate-500">{plEst.inner.thicknessMm}mm thick, 1:6 cement sand mortar with smooth finish ready for putty</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-800">{plEst.inner.netAreaSqFt.toFixed(1)}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">sq.ft</td>
                        <td className="py-2.5 px-4 text-right font-mono">₹{(plEst.inner.costs.total / (plEst.inner.netAreaSqFt || 1)).toFixed(1)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.inner.costs.total).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block">Outer Masonry Cement Plaster</span>
                          <span className="text-[11px] text-slate-500">{plEst.outer.thicknessMm}mm thick, 1:4 weather-resistant cement mortar with sand-faced finish</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-800">{plEst.outer.netAreaSqFt.toFixed(1)}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">sq.ft</td>
                        <td className="py-2.5 px-4 text-right font-mono">₹{(plEst.outer.costs.total / (plEst.outer.netAreaSqFt || 1)).toFixed(1)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.outer.costs.total).toLocaleString('en-IN')}</td>
                      </tr>
                      {plEst.rcc.netAreaSqFt > 0 && (
                        <tr>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900 block">RCC Column Plaster Finish</span>
                            <span className="text-[11px] text-slate-500">{plEst.rcc.thicknessMm}mm thick, 1:4 cement mortar with hacking / bonding slurry coat</span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{plEst.rcc.netAreaSqFt.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-center text-slate-500">sq.ft</td>
                          <td className="py-2.5 px-4 text-right font-mono">₹{(plEst.rcc.costs.total / (plEst.rcc.netAreaSqFt || 1)).toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.rcc.costs.total).toLocaleString('en-IN')}</td>
                        </tr>
                      )}
                      {plEst.rccSideBeam.netAreaSqFt > 0 && (
                        <tr>
                          <td className="py-2.5 px-4">
                            <span className="font-bold text-slate-900 block">RCC Side Beam Plaster Finish</span>
                            <span className="text-[11px] text-slate-500">{plEst.rccSideBeam.thicknessMm}mm thick, {plEst.rccSideBeam.mixRatio} mortar on exposed side faces (excl. top/soffit)</span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-900">{plEst.rccSideBeam.netAreaSqFt.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-center text-slate-500">sq.ft</td>
                          <td className="py-2.5 px-4 text-right font-mono">₹{(plEst.rccSideBeam.costs.total / (plEst.rccSideBeam.netAreaSqFt || 1)).toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.rccSideBeam.costs.total).toLocaleString('en-IN')}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block">Plaster Cement (PPC/OPC 50kg Bags)</span>
                          <span className="text-[11px] text-slate-500">Segregated exclusively for plaster mortar (dry volume conversion factor 1.33)</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-700">{Math.ceil(plEst.totalCementBags)}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">Bags</td>
                        <td className="py-2.5 px-4 text-right font-mono">₹{cementPrice}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.totalCementBags * cementPrice).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block">Plaster Sand / Fine M-Sand</span>
                          <span className="text-[11px] text-rose-600 font-semibold">Fine sand strictly with NO 20mm jalli / coarse aggregates</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700">{Math.ceil(plEst.totalSandCft)}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">CFT</td>
                        <td className="py-2.5 px-4 text-right font-mono">₹{sandPrice}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.totalSandCft * sandPrice).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4">
                          <span className="font-bold text-slate-900 block">Plaster Application Labour (Mason + Helper)</span>
                          <span className="text-[11px] text-slate-500">Based on standard ~9.5 m² per mason-helper team per day</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700">{plEst.totalLabourDays.toFixed(1)}</td>
                        <td className="py-2.5 px-4 text-center text-slate-500">Days</td>
                        <td className="py-2.5 px-4 text-right font-mono">₹850 / ₹550</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.costs.labour).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr className="bg-teal-50/80 font-extrabold text-slate-900">
                        <td colSpan={4} className="py-3 px-4 text-right border-t border-teal-300 text-sm">
                          Total Plaster &amp; Cement Finish BOQ Amount
                        </td>
                        <td className="py-3 px-4 text-right border-t border-teal-300 text-sm text-teal-800 font-mono">
                          ₹{Math.round(plEst.costs.total).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Floor-by-Floor Itemized Schedule */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>📋 Floor-by-Floor Plaster Itemized Schedule</span>
                  <span className="text-slate-400 font-normal">{plEst.floors.length} Floors Configured</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Floor Level</th>
                        <th className="py-2.5 px-3 text-left">Surface Category</th>
                        <th className="py-2.5 px-3 text-center">Thickness</th>
                        <th className="py-2.5 px-3 text-center">Mix Ratio</th>
                        <th className="py-2.5 px-3 text-right">Gross Area</th>
                        <th className="py-2.5 px-3 text-right">Deductions</th>
                        <th className="py-2.5 px-3 text-right">Net Area</th>
                        <th className="py-2.5 px-3 text-right">Wet Mortar</th>
                        <th className="py-2.5 px-3 text-right">Cement Bags</th>
                        <th className="py-2.5 px-3 text-right">Plaster Sand</th>
                        <th className="py-2.5 px-3 text-right">Surface Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {plEst.floors.map(fl => (
                        <React.Fragment key={fl.floorId}>
                          {fl.inner.netAreaSqFt > 0 && (
                            <tr className="hover:bg-teal-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{fl.floorName}</td>
                              <td className="py-2.5 px-3 font-semibold text-teal-800">🏠 Inner Masonry Plaster</td>
                              <td className="py-2.5 px-3 text-center font-mono">{fl.inner.thicknessMm} mm</td>
                              <td className="py-2.5 px-3 text-center font-mono bg-teal-50/50">{fl.inner.mixRatio}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.inner.grossAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-600">-{fl.inner.openingDeductionSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-900">{fl.inner.netAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.inner.wetVolumeM3.toFixed(2)} m³</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">{fl.inner.cementBags.toFixed(1)} bags</td>
                              <td className="py-2.5 px-3 text-right font-mono text-amber-800">{fl.inner.sandCft.toFixed(1)} CFT</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{Math.round(fl.inner.costs.total).toLocaleString('en-IN')}</td>
                            </tr>
                          )}
                          {fl.outer.netAreaSqFt > 0 && (
                            <tr className="hover:bg-sky-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{fl.floorName}</td>
                              <td className="py-2.5 px-3 font-semibold text-sky-800">🌤️ Outer Masonry Plaster</td>
                              <td className="py-2.5 px-3 text-center font-mono">{fl.outer.thicknessMm} mm</td>
                              <td className="py-2.5 px-3 text-center font-mono bg-sky-50/50">{fl.outer.mixRatio}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.outer.grossAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-600">-{fl.outer.openingDeductionSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-900">{fl.outer.netAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.outer.wetVolumeM3.toFixed(2)} m³</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-700">{fl.outer.cementBags.toFixed(1)} bags</td>
                              <td className="py-2.5 px-3 text-right font-mono text-amber-800">{fl.outer.sandCft.toFixed(1)} CFT</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{Math.round(fl.outer.costs.total).toLocaleString('en-IN')}</td>
                            </tr>
                          )}
                          {fl.rcc.netAreaSqFt > 0 && (
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{fl.floorName}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700">🏛️ RCC Column Plaster</td>
                              <td className="py-2.5 px-3 text-center font-mono">{fl.rcc.thicknessMm} mm</td>
                              <td className="py-2.5 px-3 text-center font-mono bg-slate-100">{fl.rcc.mixRatio}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.rcc.grossAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-400">—</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{fl.rcc.netAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.rcc.wetVolumeM3.toFixed(2)} m³</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{fl.rcc.cementBags.toFixed(1)} bags</td>
                              <td className="py-2.5 px-3 text-right font-mono text-amber-800">{fl.rcc.sandCft.toFixed(1)} CFT</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{Math.round(fl.rcc.costs.total).toLocaleString('en-IN')}</td>
                            </tr>
                          )}
                          {fl.rccSideBeam.netAreaSqFt > 0 && (
                            <tr className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{fl.floorName}</td>
                              <td className="py-2.5 px-3 font-semibold text-amber-900">🏗️ RCC Side Beam Plaster</td>
                              <td className="py-2.5 px-3 text-center font-mono">{fl.rccSideBeam.thicknessMm} mm</td>
                              <td className="py-2.5 px-3 text-center font-mono bg-amber-50/50">{fl.rccSideBeam.mixRatio}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.rccSideBeam.grossAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-400">—</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-950">{fl.rccSideBeam.netAreaSqFt.toFixed(1)} sq.ft</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600">{fl.rccSideBeam.wetVolumeM3.toFixed(2)} m³</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">{fl.rccSideBeam.cementBags.toFixed(1)} bags</td>
                              <td className="py-2.5 px-3 text-right font-mono text-amber-800">{fl.rccSideBeam.sandCft.toFixed(1)} CFT</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{Math.round(fl.rccSideBeam.costs.total).toLocaleString('en-IN')}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Requirement 47 & 48: Material Segregation Tables (Cement & Sand) */}
              <div className="space-y-6">
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="text-base">📦</span>
                      <span>Requirement 47: Segregated Cement Requirement Across Project Phases</span>
                    </span>
                    <span className="text-xs text-teal-800 font-mono font-bold">
                      Project Total: {(
                        computedResult.cementBags + 
                        (computedResult.foundationEstimate?.totalCementBags || 0) + 
                        (computedResult.rccProjectEstimate?.materials.cementBags || 0) + 
                        plEst.totalCementBags
                      ).toFixed(1)} Bags
                    </span>
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Construction Stage / Component</th>
                          <th className="py-2.5 px-4 text-center">Mix Ratio</th>
                          <th className="py-2.5 px-4 text-left">Specification / Layer</th>
                          <th className="py-2.5 px-4 text-right">Calculated Bags</th>
                          <th className="py-2.5 px-4 text-right">Rec. Purchase</th>
                          <th className="py-2.5 px-4 text-right">Cement Cost (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Brick Masonry Mortar Joints</td>
                          <td className="py-2.5 px-4 text-center font-mono">{mortarRatio}</td>
                          <td className="py-2.5 px-4 text-slate-600">Bedding joints across all floors</td>
                          <td className="py-2.5 px-4 text-right font-mono">{computedResult.cementBags.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{Math.ceil(computedResult.cementBags)} Bags</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(computedResult.cementBags * cementPrice).toLocaleString('en-IN')}</td>
                        </tr>
                        {computedResult.foundationEstimate && (computedResult.foundationEstimate.totalCementBags || 0) > 0 && (
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-amber-900">Foundation Substructure (PCC + Footings)</td>
                            <td className="py-2.5 px-4 text-center font-mono">1:4:8 &amp; 1:1.5:3</td>
                            <td className="py-2.5 px-4 text-slate-600">PCC Bed + Isolated Footings</td>
                            <td className="py-2.5 px-4 text-right font-mono text-amber-800">{(computedResult.foundationEstimate.totalCementBags || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-900">{Math.ceil(computedResult.foundationEstimate.totalCementBags || 0)} Bags</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round((computedResult.foundationEstimate.totalCementBags || 0) * cementPrice).toLocaleString('en-IN')}</td>
                          </tr>
                        )}
                        {computedResult.rccProjectEstimate && (computedResult.rccProjectEstimate.materials.cementBags || 0) > 0 && (
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-orange-900">RCC Superstructure Frame</td>
                            <td className="py-2.5 px-4 text-center font-mono">{rccMixRatio}</td>
                            <td className="py-2.5 px-4 text-slate-600">Pillars, Ring Beams &amp; Roof Slab</td>
                            <td className="py-2.5 px-4 text-right font-mono text-orange-800">{(computedResult.rccProjectEstimate.materials.cementBags || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-900">{Math.ceil(computedResult.rccProjectEstimate.materials.cementBags || 0)} Bags</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round((computedResult.rccProjectEstimate.materials.cementBags || 0) * cementPrice).toLocaleString('en-IN')}</td>
                          </tr>
                        )}
                        <tr className="bg-teal-50/40">
                          <td className="py-2.5 px-4 font-bold text-teal-950">🏠 Inner Masonry Plaster Finish</td>
                          <td className="py-2.5 px-4 text-center font-mono text-teal-800">{plEst.inner.mixRatio}</td>
                          <td className="py-2.5 px-4 text-teal-700">{plEst.inner.thicknessMm}mm internal walls &amp; partitions</td>
                          <td className="py-2.5 px-4 text-right font-mono text-teal-800">{plEst.inner.cementBags.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-900">{Math.ceil(plEst.inner.cementBags)} Bags</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-900">₹{Math.round(plEst.inner.cementBags * cementPrice).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="bg-sky-50/40">
                          <td className="py-2.5 px-4 font-bold text-sky-950">🌤️ Outer Masonry Plaster Finish</td>
                          <td className="py-2.5 px-4 text-center font-mono text-sky-800">{plEst.outer.mixRatio}</td>
                          <td className="py-2.5 px-4 text-sky-700">{plEst.outer.thicknessMm}mm external exposed walls</td>
                          <td className="py-2.5 px-4 text-right font-mono text-sky-800">{plEst.outer.cementBags.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-900">{Math.ceil(plEst.outer.cementBags)} Bags</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-900">₹{Math.round(plEst.outer.cementBags * cementPrice).toLocaleString('en-IN')}</td>
                        </tr>
                        {plEst.rcc.cementBags > 0 && (
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-slate-900">🏛️ RCC Column Plaster Finish</td>
                            <td className="py-2.5 px-4 text-center font-mono text-slate-700">{plEst.rcc.mixRatio}</td>
                            <td className="py-2.5 px-4 text-slate-600">{plEst.rcc.thicknessMm}mm column exposed surfaces</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-700">{plEst.rcc.cementBags.toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{Math.ceil(plEst.rcc.cementBags)} Bags</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.rcc.cementBags * cementPrice).toLocaleString('en-IN')}</td>
                          </tr>
                        )}
                        {plEst.rccSideBeam.cementBags > 0 && (
                          <tr className="bg-amber-50/40">
                            <td className="py-2.5 px-4 font-bold text-amber-950">🏗️ RCC Side Beam Plaster Finish</td>
                            <td className="py-2.5 px-4 text-center font-mono text-amber-800">{plEst.rccSideBeam.mixRatio}</td>
                            <td className="py-2.5 px-4 text-amber-800">{plEst.rccSideBeam.thicknessMm}mm side beam exposed faces (excl. top/soffit)</td>
                            <td className="py-2.5 px-4 text-right font-mono text-amber-800">{plEst.rccSideBeam.cementBags.toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-900">{Math.ceil(plEst.rccSideBeam.cementBags)} Bags</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">₹{Math.round(plEst.rccSideBeam.cementBags * cementPrice).toLocaleString('en-IN')}</td>
                          </tr>
                        )}
                        <tr className="bg-slate-900 text-white font-bold">
                          <td colSpan={3} className="py-3 px-4 text-right text-xs uppercase tracking-wider">
                            Total Combined Project Cement (All Stages)
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400">
                            {(
                              computedResult.cementBags + 
                              (computedResult.foundationEstimate?.totalCementBags || 0) + 
                              (computedResult.rccProjectEstimate?.materials.cementBags || 0) + 
                              plEst.totalCementBags
                            ).toFixed(1)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-300 font-extrabold">
                            {Math.ceil(
                              computedResult.cementBags + 
                              (computedResult.foundationEstimate?.totalCementBags || 0) + 
                              (computedResult.rccProjectEstimate?.materials.cementBags || 0) + 
                              plEst.totalCementBags
                            )} Bags
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400">
                            ₹{Math.round(
                              (
                                computedResult.cementBags + 
                                (computedResult.foundationEstimate?.totalCementBags || 0) + 
                                (computedResult.rccProjectEstimate?.materials.cementBags || 0) + 
                                plEst.totalCementBags
                              ) * cementPrice
                            ).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Requirement 48: Segregated Sand & Aggregates Breakdown */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="text-base">🏖️</span>
                      <span>Requirement 48: Segregated Sand &amp; Aggregates (Strictly NO 20mm Jalli in Plaster)</span>
                    </span>
                    <span className="text-xs text-amber-800 font-mono font-bold">
                      Plaster Sand: {plEst.totalSandCft.toFixed(1)} CFT (Fine M-Sand Only)
                    </span>
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Component</th>
                          <th className="py-2.5 px-4 text-left">Material Grade / Specification</th>
                          <th className="py-2.5 px-4 text-right">Sand / Fine Agg (CFT)</th>
                          <th className="py-2.5 px-4 text-right">Coarse Jalli 20mm/40mm (CFT)</th>
                          <th className="py-2.5 px-4 text-left">Quality &amp; Technical Rule</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Brick Masonry Mortar</td>
                          <td className="py-2.5 px-4 text-slate-600">Coarse River Sand / M-Sand Zone II</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{(computedResult.sandVolume * 35.3147).toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-400">— (None)</td>
                          <td className="py-2.5 px-4 text-slate-500">Free from silt &gt; 5%, screened for joints</td>
                        </tr>
                        {computedResult.foundationEstimate && (computedResult.foundationEstimate.totalSandCft || 0) > 0 && (
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-amber-900">Foundation Substructure</td>
                            <td className="py-2.5 px-4 text-slate-600">Concrete Sand + 40mm PCC / 20mm Footings</td>
                            <td className="py-2.5 px-4 text-right font-mono text-amber-800">{(computedResult.foundationEstimate.totalSandCft || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-amber-800">{(computedResult.foundationEstimate.totalCoarseAggCft || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-slate-500">Graded hard granite blue metal for footings</td>
                          </tr>
                        )}
                        {computedResult.rccProjectEstimate && (computedResult.rccProjectEstimate.materials.sandCft || 0) > 0 && (
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-orange-900">RCC Structural Frame</td>
                            <td className="py-2.5 px-4 text-slate-600">Zone II Concrete Sand + 20mm Blue Metal</td>
                            <td className="py-2.5 px-4 text-right font-mono text-orange-800">{(computedResult.rccProjectEstimate.materials.sandCft || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-orange-800">{(computedResult.rccProjectEstimate.materials.aggregateCft || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-slate-500">20mm graded jalli for beam-column cages</td>
                          </tr>
                        )}
                        <tr className="bg-teal-50/50">
                          <td className="py-2.5 px-4 font-bold text-teal-950">🏠 Inner Masonry Plaster</td>
                          <td className="py-2.5 px-4 text-teal-800">Fine Plaster Sand / Screened M-Sand</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-teal-800">{plEst.inner.sandCft.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">0.0 (NO Jalli)</td>
                          <td className="py-2.5 px-4 text-teal-900 font-medium">Fine sieved &lt; 1.5mm for smooth putty ready surface</td>
                        </tr>
                        <tr className="bg-sky-50/50">
                          <td className="py-2.5 px-4 font-bold text-sky-950">🌤️ Outer Masonry Plaster</td>
                          <td className="py-2.5 px-4 text-sky-800">Medium Plaster Sand / Plaster M-Sand</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-sky-800">{plEst.outer.sandCft.toFixed(1)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">0.0 (NO Jalli)</td>
                          <td className="py-2.5 px-4 text-sky-900 font-medium">Sharp angular sand for crack-free weather rendering</td>
                        </tr>
                        {plEst.rcc.sandCft > 0 && (
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-4 font-bold text-slate-900">🏛️ RCC Column Plaster</td>
                            <td className="py-2.5 px-4 text-slate-700">Fine Screened Sand / P-Sand</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700">{plEst.rcc.sandCft.toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">0.0 (NO Jalli)</td>
                            <td className="py-2.5 px-4 text-slate-600 font-medium">Thin 6mm coat directly over concrete column bonding layer</td>
                          </tr>
                        )}
                        {plEst.rccSideBeam.sandCft > 0 && (
                          <tr className="bg-amber-50/40">
                            <td className="py-2.5 px-4 font-bold text-amber-950">🏗️ RCC Side Beam Plaster</td>
                            <td className="py-2.5 px-4 text-amber-800">Fine Screened Sand / P-Sand</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-900">{plEst.rccSideBeam.sandCft.toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">0.0 (NO Jalli)</td>
                            <td className="py-2.5 px-4 text-amber-950 font-medium">Thin coat over side beam faces (strictly fine sand)</td>
                          </tr>
                        )}
                        <tr className="bg-amber-100/70 font-bold text-slate-900">
                          <td colSpan={2} className="py-2.5 px-4 text-right text-xs uppercase">
                            Total Project Sand Requirement
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-amber-900 font-extrabold text-sm">
                            {(
                              (computedResult.sandVolume * 35.3147) + 
                              (computedResult.foundationEstimate?.totalSandCft || 0) + 
                              (computedResult.rccProjectEstimate?.materials.sandCft || 0) + 
                              plEst.totalSandCft
                            ).toFixed(1)} CFT
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700 font-extrabold text-sm">
                            {(
                              (computedResult.foundationEstimate?.totalCoarseAggCft || 0) + 
                              (computedResult.rccProjectEstimate?.materials.aggregateCft || 0)
                            ).toFixed(1)} CFT
                          </td>
                          <td className="py-2.5 px-4 text-xs text-amber-950 font-bold">
                            Separate delivery recommended: Plaster sand vs Concrete gravel
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Engineering Specifications & Notes */}
              <div className="bg-teal-50/40 p-5 rounded-xl border border-teal-200 space-y-3 text-xs">
                <h4 className="font-bold text-teal-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Paintbrush className="w-4 h-4 text-teal-700" />
                  <span>Plaster Engineering Specifications &amp; Standards</span>
                </h4>
                <div className="space-y-2 text-slate-700 leading-relaxed">
                  <p><b>• Inner Masonry Plaster:</b> 12 mm thickness, mix ratio 1:6 cement mortar. Smooth sponge/trowel finish ready for putty.</p>
                  <p><b>• Outer Masonry Plaster:</b> 15 mm thickness, rich mix ratio 1:4 cement mortar with weather-resistant sand finish.</p>
                  <p><b>• RCC Column Plaster:</b> 6 mm thickness, mix ratio 1:4 cement mortar with hacking/bonding coat applied to column surfaces.</p>
                  <p><b>• RCC Side Beam Plaster:</b> 6 mm thickness, mix ratio 1:4 cement mortar applied strictly to exposed vertical side beam faces (excluding slab-contact top and soffit).</p>
                  <p><b>• Deductions:</b> Full opening deduction for doors, windows, and ventilators according to IS 1200 Part XII guidelines.</p>
                  <div className="p-2.5 bg-teal-100/70 border border-teal-300 rounded-lg text-[11px] text-teal-950 leading-relaxed mt-2">
                    <b>Material Segregation Guarantee:</b> Plaster cement bags and sand are strictly calculated and displayed separately from brick masonry mortar and foundation concrete. Plaster uses sand only (strictly NO 20mm jalli).
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Live RCC Structural Construction Estimate (Pillars, Ring Beams, Full RCC Top) */}
      {computedResult.rccProjectEstimate && computedResult.rccProjectEstimate.totalConcreteVolumeM3 > 0 && (() => {
        const rcc = computedResult.rccProjectEstimate;

        return (
          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden mt-8">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 border-b border-slate-700 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <span className="text-2xl">🏗️</span> Live RCC Structural Construction Estimate
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Reinforced Concrete model-driven estimation for Pillars, Ring Beams, and Full RCC Top across all floors.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-orange-500/20 text-orange-300 border border-orange-500/40 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                  {rcc.totalConcreteVolumeCft.toFixed(1)} CFT ({rcc.totalConcreteVolumeM3.toFixed(2)} m³)
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                  RCC Cost: ₹{Math.round(rcc.costs.total).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Floor-by-Floor Breakdown Cards */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <span>🏢 Floor-by-Floor RCC Breakdown</span>
                  <span className="text-slate-400 font-normal">({rcc.floors.length} {rcc.floors.length === 1 ? 'Floor' : 'Floors'})</span>
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  {rcc.floors.map((fl) => (
                    <div key={fl.floorId} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                      <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{fl.floorName}</span>
                          <span className="bg-slate-200 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded">Level {fl.floorLevel}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-slate-600 font-medium">Concrete: <b>{fl.concreteVolumeCft.toFixed(1)} CFT</b></span>
                          <span className="text-slate-600 font-medium">Steel: <b>{fl.steelKg.toFixed(1)} kg</b></span>
                          <span className="text-emerald-700 font-bold">₹{Math.round(fl.costs.total).toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Elements in this floor */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Pillars */}
                          <div className={cn("p-3.5 rounded-lg border", fl.elements.pillars.count > 0 ? "bg-white border-slate-200 shadow-xs" : "bg-slate-50 border-slate-100 text-slate-400")}>
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                <span>🏛️</span> Pillars / Columns
                              </span>
                              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {fl.elements.pillars.count} Nos
                              </span>
                            </div>
                            {fl.elements.pillars.count > 0 ? (
                              <div className="text-[11px] space-y-1 text-slate-600">
                                <div className="flex justify-between"><span>Concrete:</span> <span className="font-mono font-medium">{fl.elements.pillars.concreteVolumeCft.toFixed(1)} CFT</span></div>
                                <div className="flex justify-between"><span>Steel:</span> <span className="font-mono font-medium">{fl.elements.pillars.steelKg.toFixed(1)} kg</span></div>
                                <div className="flex justify-between"><span>Cement:</span> <span className="font-mono font-medium">{fl.elements.pillars.cementBags} Bags</span></div>
                                <div className="flex justify-between pt-1 border-t border-slate-100 font-semibold text-slate-900">
                                  <span>Element Cost:</span> <span>₹{Math.round(fl.elements.pillars.cost).toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] italic mt-2">No active columns on this floor</p>
                            )}
                          </div>

                          {/* Ring Beams */}
                          <div className={cn("p-3.5 rounded-lg border", fl.elements.ringBeams.concreteVolumeM3 > 0 ? "bg-white border-slate-200 shadow-xs" : "bg-slate-50 border-slate-100 text-slate-400")}>
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                <span>📏</span> RCC Ring Beam
                              </span>
                              <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded", fl.elements.ringBeams.concreteVolumeM3 > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                                {fl.elements.ringBeams.concreteVolumeM3 > 0 ? 'Active' : 'Suppressed'}
                              </span>
                            </div>
                            {fl.elements.ringBeams.concreteVolumeM3 > 0 ? (
                              <div className="text-[11px] space-y-1 text-slate-600">
                                <div className="flex justify-between"><span>Concrete:</span> <span className="font-mono font-medium">{fl.elements.ringBeams.concreteVolumeCft.toFixed(1)} CFT</span></div>
                                <div className="flex justify-between"><span>Steel:</span> <span className="font-mono font-medium">{fl.elements.ringBeams.steelKg.toFixed(1)} kg</span></div>
                                <div className="flex justify-between"><span>Cement:</span> <span className="font-mono font-medium">{fl.elements.ringBeams.cementBags} Bags</span></div>
                                <div className="flex justify-between pt-1 border-t border-slate-100 font-semibold text-slate-900">
                                  <span>Element Cost:</span> <span>₹{Math.round(fl.elements.ringBeams.cost).toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] italic mt-2">Mode suppressed or not configured</p>
                            )}
                          </div>

                          {/* Full RCC Top */}
                          <div className={cn("p-3.5 rounded-lg border", fl.elements.fullRccTop.count > 0 ? "bg-white border-slate-200 shadow-xs" : "bg-slate-50 border-slate-100 text-slate-400")}>
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                <span>🛡️</span> Full RCC Top / Roof
                              </span>
                              <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded", fl.elements.fullRccTop.count > 0 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-400")}>
                                {fl.elements.fullRccTop.count > 0 ? `${fl.elements.fullRccTop.count} Closed Bays` : 'OFF'}
                              </span>
                            </div>
                            {fl.elements.fullRccTop.count > 0 ? (
                              <div className="text-[11px] space-y-1 text-slate-600">
                                <div className="flex justify-between"><span>Concrete:</span> <span className="font-mono font-medium">{fl.elements.fullRccTop.concreteVolumeCft.toFixed(1)} CFT</span></div>
                                <div className="flex justify-between"><span>Steel:</span> <span className="font-mono font-medium">{fl.elements.fullRccTop.steelKg.toFixed(1)} kg</span></div>
                                <div className="flex justify-between"><span>Cement:</span> <span className="font-mono font-medium">{fl.elements.fullRccTop.cementBags} Bags</span></div>
                                <div className="flex justify-between pt-1 border-t border-slate-100 font-semibold text-slate-900">
                                  <span>Element Cost:</span> <span>₹{Math.round(fl.elements.fullRccTop.cost).toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] italic mt-2">No closed pillar bays detected</p>
                            )}
                          </div>
                        </div>

                        {/* Floor Material Summary Table */}
                        <div className="bg-white rounded-lg border border-slate-200 p-3.5 text-xs">
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center">
                            <div className="p-2 bg-slate-50 rounded">
                              <span className="text-[10px] text-slate-500 block">Cement</span>
                              <span className="font-bold text-slate-900 font-mono">{fl.cementBags} Bags</span>
                            </div>
                            <div className="p-2 bg-slate-50 rounded">
                              <span className="text-[10px] text-slate-500 block">M-Sand</span>
                              <span className="font-bold text-slate-900 font-mono">{fl.sandCft.toFixed(1)} CFT</span>
                            </div>
                            <div className="p-2 bg-slate-50 rounded">
                              <span className="text-[10px] text-slate-500 block">20mm Jalli</span>
                              <span className="font-bold text-slate-900 font-mono">{fl.aggregateCft.toFixed(1)} CFT</span>
                            </div>
                            <div className="p-2 bg-slate-50 rounded">
                              <span className="text-[10px] text-slate-500 block">TMT Steel</span>
                              <span className="font-bold text-slate-900 font-mono">{fl.steelKg.toFixed(1)} kg</span>
                            </div>
                            <div className="p-2 bg-slate-50 rounded">
                              <span className="text-[10px] text-slate-500 block">Water</span>
                              <span className="font-bold text-slate-900 font-mono">{fl.waterLitres} L</span>
                            </div>
                            <div className="p-2 bg-slate-50 rounded">
                              <span className="text-[10px] text-slate-500 block">Cover Blocks</span>
                              <span className="font-bold text-slate-900 font-mono">{fl.coverBlocks} Nos</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cumulative Project RCC Summary Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="col-span-1 lg:col-span-2 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📊 Total Project RCC Materials & Recommended Purchase</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Material Item</th>
                          <th className="py-2.5 px-4 text-right">Calculated Quantity</th>
                          <th className="py-2.5 px-4 text-right">Rec. Purchase</th>
                          <th className="py-2.5 px-4 text-right">Rate</th>
                          <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Cement (50kg bags)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalCementExactBags.toFixed(1)} Bags</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{rcc.recommendedPurchase.cementBags} Bags</td>
                          <td className="py-2.5 px-4 text-right">₹{cementPrice}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.cement).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">M-Sand (Fine Aggregate)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalSandCft.toFixed(1)} CFT ({rcc.totalSandM3.toFixed(2)} m³)</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{rcc.recommendedPurchase.sandCft} CFT</td>
                          <td className="py-2.5 px-4 text-right">₹{sandPrice} / CFT</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.sand).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">20mm Jalli (Coarse Aggregate)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalAggregateCft.toFixed(1)} CFT ({rcc.totalAggregateM3.toFixed(2)} m³)</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{rcc.recommendedPurchase.aggregateCft} CFT</td>
                          <td className="py-2.5 px-4 text-right">₹{aggregatePrice} / CFT</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.aggregate).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">TMT Steel Reinforcement</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalSteelKg.toFixed(1)} kg ({rcc.totalSteelTonnes.toFixed(3)} T)</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{rcc.recommendedPurchase.steelKg} kg</td>
                          <td className="py-2.5 px-4 text-right">₹{steelRate} / kg</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.steel).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Binding Wire</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalBindingWireKg.toFixed(1)} kg</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{rcc.recommendedPurchase.bindingWireKg} kg</td>
                          <td className="py-2.5 px-4 text-right">₹85 / kg</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.bindingWire).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Cover Blocks</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalCoverBlocks} Nos</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{rcc.recommendedPurchase.coverBlocks} Nos</td>
                          <td className="py-2.5 px-4 text-right">₹3 / piece</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.coverBlocks).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Water (Approx)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalWaterLitres.toLocaleString()} Litres</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right text-slate-500">Site water</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">RCC Concreting Labour</td>
                          <td className="py-2.5 px-4 text-right font-mono">{rcc.totalConcreteVolumeM3.toFixed(2)} m³</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right">₹{rccLabourRate} / m³</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(rcc.costs.labour).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="bg-slate-100 font-extrabold text-slate-900">
                          <td colSpan={4} className="py-3 px-4 text-right border-t border-slate-300 text-sm">Total Project RCC Cost</td>
                          <td className="py-3 px-4 text-right border-t border-slate-300 text-sm text-emerald-600">₹{Math.round(rcc.costs.total).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RCC Pricing & Grade Controls */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">⚙️ RCC Calculation Settings</h4>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Concrete Grade / Mix Ratio</label>
                      <select 
                        value={rccMixRatio} 
                        onChange={e => setRccMixRatio(e.target.value as any)} 
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-medium text-slate-900"
                      >
                        <option value="1:1.5:3">M20 (1 : 1.5 : 3 - Cement : M-Sand : Jalli)</option>
                        <option value="1:2:4">M15 (1 : 2 : 4 - Standard RCC)</option>
                        <option value="1:3:6">M10 (1 : 3 : 6 - Lean Concrete / Base)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Jalli (₹ / CFT)</label>
                        <input 
                          type="number" 
                          value={aggregatePrice} 
                          onChange={e => setAggregatePrice(Number(e.target.value))} 
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Steel (₹ / kg)</label>
                        <input 
                          type="number" 
                          value={steelRate} 
                          onChange={e => setSteelRate(Number(e.target.value))} 
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">RCC Labour (₹ / m³)</label>
                      <input 
                        type="number" 
                        value={rccLabourRate} 
                        onChange={e => setRccLabourRate(Number(e.target.value))} 
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                      💡 <b>Engineering Rule:</b> Dry volume conversion factor = 1.54. Steel weight formula = D²/162 kg/m. All quantities update live as you edit the 3D model.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ground Floor Foundation & Sub-grade Construction Estimate */}
      {computedResult.foundationEstimate && (computedResult.foundationEstimate.footingCount ?? 0) > 0 && (() => {
        const fnd = computedResult.foundationEstimate!;

        return (
          <div className="bg-white rounded-xl shadow-md border border-amber-200 overflow-hidden mt-8">
            <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 px-6 py-5 border-b border-amber-800/60 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <span className="text-2xl">🏛️</span> Ground Floor Foundation / Base Estimate
                </h3>
                <p className="text-xs text-amber-200/90 mt-1">
                  Layer-by-layer sub-grade estimation: Soil Bed → Excavation → Sand Filling → Plain PCC Base → RCC Footings + Starter Dowels → Plinth/DPC.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                  {fnd.footingCount} Isolated Footings
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg font-bold font-mono">
                  Foundation Cost: ₹{Math.round(fnd.costs.total).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Layer Volume Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-center">
                <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">🚜 Total Excavation</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{fnd.totalExcavationVolumeCft.toFixed(1)} CFT</span>
                  <span className="text-[10px] text-slate-500 font-mono">({fnd.totalExcavationVolumeM3.toFixed(2)} m³)</span>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">🏖️ Sand Filling</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{fnd.totalSandFillVolumeCft.toFixed(1)} CFT</span>
                  <span className="text-[10px] text-slate-500 font-mono">({fnd.totalSandFillVolumeM3.toFixed(2)} m³)</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-700 block">🧱 Plain PCC Base</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{fnd.totalPccVolumeCft.toFixed(1)} CFT</span>
                  <span className="text-[10px] text-slate-500 font-mono">({fnd.totalPccVolumeM3.toFixed(2)} m³ • No Steel)</span>
                </div>
                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-indigo-800 block">🏛️ RCC Footing Concrete</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{fnd.totalFootingVolumeCft.toFixed(1)} CFT</span>
                  <span className="text-[10px] text-slate-500 font-mono">({fnd.totalFootingVolumeM3.toFixed(2)} m³)</span>
                </div>
                <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-900 block">🏛️ Column Stubs</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{(fnd.totalStubVolumeCft ?? 0).toFixed(1)} CFT</span>
                  <span className="text-[10px] text-slate-500 font-mono">({(fnd.totalStubVolumeM3 ?? 0).toFixed(2)} m³ • RCC)</span>
                </div>
                <div className="p-3 bg-cyan-50/60 border border-cyan-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-cyan-800 block">🔩 TMT Steel (Mesh+Starter)</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{fnd.totalSteelKg.toFixed(1)} kg</span>
                  <span className="text-[10px] text-slate-500 font-mono">({(fnd.totalSteelKg / 1000).toFixed(3)} Tonnes)</span>
                </div>
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">🛡️ Plinth / DPC Area</span>
                  <span className="font-bold text-slate-900 font-mono text-sm block mt-1">{fnd.dpcAreaSqFt.toFixed(1)} sq.ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({fnd.dpcAreaSqM.toFixed(2)} m²)</span>
                </div>
              </div>

              {/* Footing-by-Footing Breakdown Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>📋 Footing-by-Footing Schedule & Dimensions</span>
                  <span className="text-slate-400 font-normal">{fnd.items.length} Structural Units</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Footing / Pillar</th>
                        <th className="py-2.5 px-3 text-center">Excavation (L×W×D)</th>
                        <th className="py-2.5 px-3 text-center">Sand Fill Depth</th>
                        <th className="py-2.5 px-3 text-center">PCC Base (L×W×T)</th>
                        <th className="py-2.5 px-3 text-center">RCC Footing (L×W×D)</th>
                        <th className="py-2.5 px-3 text-center">Column Stub (H×W×D)</th>
                        <th className="py-2.5 px-3 text-right">Steel Mesh + Starter</th>
                        <th className="py-2.5 px-3 text-right">Unit Total Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {fnd.items.map((item) => (
                        <tr key={item.footingId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.pillarName ? `${item.pillarName} Footing` : item.footingId}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.excavationVolumeCft.toFixed(1)} CFT
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.sandFillVolumeCft.toFixed(1)} CFT
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.pccVolumeCft.toFixed(1)} CFT ({item.pccMixRatio})
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.footingVolumeCft.toFixed(1)} CFT ({item.concreteGrade})
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.columnStubHeight ?? 2}' ht ({item.columnStubWidth ?? 9}"×{item.columnStubDepth ?? 9}")
                            <span className="text-[10px] text-slate-400 block">{(item.stubVolumeCft ?? 0).toFixed(1)} CFT</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-700">
                            {item.steelKg.toFixed(1)} kg
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            ₹{Math.round(item.costs.total).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Foundation Materials & Recommended Purchase Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="col-span-1 lg:col-span-2 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📊 Total Foundation Materials & Recommended Purchase</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                        <tr>
                          <th className="py-2.5 px-4 text-left">Material / Operation Item</th>
                          <th className="py-2.5 px-4 text-right">Calculated Quantity</th>
                          <th className="py-2.5 px-4 text-right">Rec. Purchase</th>
                          <th className="py-2.5 px-4 text-right">Rate</th>
                          <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Earth Excavation (Pit digging)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalExcavationVolumeM3.toFixed(2)} m³ ({fnd.totalExcavationVolumeCft.toFixed(1)} CFT)</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right">₹{excavationRate} / m³</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.excavation).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Sand Filling (Base bed compaction)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalSandFillVolumeCft.toFixed(1)} CFT</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-600">{fnd.recommendedPurchase.sandFillCft} CFT</td>
                          <td className="py-2.5 px-4 text-right">₹{sandFillRate} / CFT</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.sandFill).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">PCC Base Lean Concrete (1:4:8 / 1:3:6)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalPccVolumeM3.toFixed(2)} m³</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right">₹{pccLabourRate} / m³</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.pccLabour).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">RCC Footing Concreting Labour</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalFootingVolumeM3.toFixed(2)} m³</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right">₹{footingLabourRate} / m³</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.footingLabour).toLocaleString('en-IN')}</td>
                        </tr>
                        {fnd.totalStubVolumeM3 && fnd.totalStubVolumeM3 > 0 ? (
                          <tr>
                            <td className="py-2.5 px-4 font-bold text-slate-900">RCC Column Stub Concreting Labour</td>
                            <td className="py-2.5 px-4 text-right font-mono">{fnd.totalStubVolumeM3.toFixed(2)} m³ ({(fnd.totalStubVolumeCft ?? 0).toFixed(1)} CFT)</td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                            <td className="py-2.5 px-4 text-right">₹{footingLabourRate} / m³</td>
                            <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.stubLabour ?? 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ) : null}
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Cement (PCC + Footings + Stubs)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalCementExactBags.toFixed(1)} Bags</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{fnd.recommendedPurchase.cementBags} Bags</td>
                          <td className="py-2.5 px-4 text-right">₹{cementPrice}</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.cement).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">M-Sand (PCC + Footings + Stubs)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalSandCft.toFixed(1)} CFT</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{fnd.recommendedPurchase.sandCft} CFT</td>
                          <td className="py-2.5 px-4 text-right">₹{sandPrice} / CFT</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.sand).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">20mm/40mm Coarse Aggregate (Jalli)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalAggregateCft.toFixed(1)} CFT</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{fnd.recommendedPurchase.aggregateCft} CFT</td>
                          <td className="py-2.5 px-4 text-right">₹{aggregatePrice} / CFT</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.aggregate).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">TMT Steel (Mesh + Stub Starters & Ties)</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalSteelKg.toFixed(1)} kg</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{fnd.recommendedPurchase.steelKg} kg</td>
                          <td className="py-2.5 px-4 text-right">₹{steelRate} / kg</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.steel).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Binding Wire & Cover Blocks</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.totalBindingWireKg.toFixed(1)} kg • {fnd.totalCoverBlocks} Nos</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-orange-600">{fnd.recommendedPurchase.bindingWireKg} kg</td>
                          <td className="py-2.5 px-4 text-right">₹85/kg • ₹3/pc</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.bindingWire + fnd.costs.coverBlocks).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 font-bold text-slate-900">Plinth / DPC Damp Proof Course</td>
                          <td className="py-2.5 px-4 text-right font-mono">{fnd.dpcAreaSqM.toFixed(2)} m² ({fnd.dpcAreaSqFt.toFixed(1)} sq.ft)</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-500">—</td>
                          <td className="py-2.5 px-4 text-right">₹150 / m²</td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{Math.round(fnd.costs.dpc).toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="bg-amber-50/80 font-extrabold text-slate-900">
                          <td colSpan={4} className="py-3 px-4 text-right border-t border-amber-300 text-sm">Total Foundation & Base Cost</td>
                          <td className="py-3 px-4 text-right border-t border-amber-300 text-sm text-amber-800 font-mono">₹{Math.round(fnd.costs.total).toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Foundation Rate & Calculation Settings */}
                <div className="bg-amber-50/40 p-5 rounded-xl border border-amber-200 space-y-4">
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1">
                    <span>⚙️</span> Foundation Unit Rates
                  </h4>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Excavation Rate (₹ / m³)</label>
                      <input 
                        type="number" 
                        value={excavationRate} 
                        onChange={e => setExcavationRate(Number(e.target.value))} 
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Sand Filling Rate (₹ / CFT)</label>
                      <input 
                        type="number" 
                        value={sandFillRate} 
                        onChange={e => setSandFillRate(Number(e.target.value))} 
                        className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">PCC Labour (₹/m³)</label>
                        <input 
                          type="number" 
                          value={pccLabourRate} 
                          onChange={e => setPccLabourRate(Number(e.target.value))} 
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">Footing Labour (₹/m³)</label>
                        <input 
                          type="number" 
                          value={footingLabourRate} 
                          onChange={e => setFootingLabourRate(Number(e.target.value))} 
                          className="w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg font-mono text-slate-900" 
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-[11px] text-amber-950 leading-relaxed space-y-1">
                      <div className="font-bold flex items-center gap-1 text-amber-900">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                        Structural Engineering Notice:
                      </div>
                      Foundation dimensions, reinforcement and bearing capacity must be verified by a qualified structural engineer using actual site soil investigation data.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Section 4b Plaster Estimate has been relocated directly after Brick Masonry (Section 2b) */}

      {/* 5. Cost Summary */}
      <div className="bg-gray-900 rounded-lg shadow-xl overflow-hidden border border-gray-800 text-white mt-8">
        <div className="bg-black/50 px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white flex items-center">AI Visual Building Estimate</h3>
        </div>
        <div className="p-6">
          <table className="min-w-full divide-y divide-gray-800 text-sm mb-6">
            <thead>
              <tr className="text-gray-400 text-left font-medium tracking-wider text-xs uppercase">
                <th className="pb-3 pr-4">Item</th>
                <th className="pb-3 px-4 text-right">Quantity</th>
                <th className="pb-3 px-4 text-left">Unit</th>
                <th className="pb-3 px-4 text-right">Rate</th>
                <th className="pb-3 pl-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              <tr>
                <td className="py-3 pr-4">{brickType.supplierBrand || 'A V M Bricks'}</td>
                <td className="py-3 px-4 text-right">{computedResult.totalBricks.toLocaleString()}</td>
                <td className="py-3 px-4 text-left">Nos</td>
                <td className="py-3 px-4 text-right">₹{brickPrice}</td>
                <td className="py-3 pl-4 text-right font-medium">₹{computedResult.costs.bricks.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Cement</td>
                <td className="py-3 px-4 text-right">{computedResult.cementBags.toLocaleString()}</td>
                <td className="py-3 px-4 text-left">Bags</td>
                <td className="py-3 px-4 text-right">₹{cementPrice}</td>
                <td className="py-3 pl-4 text-right font-medium">₹{computedResult.costs.cement.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Sand</td>
                <td className="py-3 px-4 text-right">{sandUnit === 'CFT' ? (computedResult.sandVolume * 35.3147).toFixed(1) : computedResult.sandVolume.toFixed(2)}</td>
                <td className="py-3 px-4 text-left">{sandUnit}</td>
                <td className="py-3 px-4 text-right">₹{sandPrice}</td>
                <td className="py-3 pl-4 text-right font-medium">₹{computedResult.costs.sand.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Mortar Volume</td>
                <td className="py-3 px-4 text-right">{computedResult.wetMortarVolume.toFixed(2)}</td>
                <td className="py-3 px-4 text-left">m³</td>
                <td className="py-3 px-4 text-right">—</td>
                <td className="py-3 pl-4 text-right font-medium text-gray-400">Included</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Mason Labour</td>
                <td className="py-3 px-4 text-right">{masonDays}</td>
                <td className="py-3 px-4 text-left">Days</td>
                <td className="py-3 px-4 text-right">₹{masonWage}</td>
                <td className="py-3 pl-4 text-right font-medium">₹{masonCost.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">Helper Labour</td>
                <td className="py-3 px-4 text-right">{helperDays}</td>
                <td className="py-3 px-4 text-left">Days</td>
                <td className="py-3 px-4 text-right">₹{helperWage}</td>
                <td className="py-3 pl-4 text-right font-medium">₹{helperCost.toLocaleString()}</td>
              </tr>
              {computedResult.rccProjectEstimate && computedResult.rccProjectEstimate.totalConcreteVolumeM3 > 0 && (
                <tr className="bg-slate-800/80 font-semibold text-orange-400">
                  <td className="py-3 pr-4">RCC Structural Construction (All Floors)</td>
                  <td className="py-3 px-4 text-right">{computedResult.rccProjectEstimate.totalConcreteVolumeCft.toFixed(1)}</td>
                  <td className="py-3 px-4 text-left">CFT</td>
                  <td className="py-3 px-4 text-right">—</td>
                  <td className="py-3 pl-4 text-right font-bold text-orange-400">₹{Math.round(computedResult.rccProjectEstimate.costs.total).toLocaleString('en-IN')}</td>
                </tr>
              )}
              {computedResult.foundationEstimate && (computedResult.foundationEstimate.footingCount ?? 0) > 0 && (
                <tr className="bg-amber-950/40 font-semibold text-amber-400">
                  <td className="py-3 pr-4">Ground Floor Foundation / Base (PCC + RCC Footings)</td>
                  <td className="py-3 px-4 text-right">{computedResult.foundationEstimate.footingCount}</td>
                  <td className="py-3 px-4 text-left">Units</td>
                  <td className="py-3 px-4 text-right">—</td>
                  <td className="py-3 pl-4 text-right font-bold text-amber-400">₹{Math.round(computedResult.foundationEstimate.costs.total).toLocaleString('en-IN')}</td>
                </tr>
              )}
              {computedResult.plasterEstimate && computedResult.plasterEstimate.totalNetPlasterAreaSqFt > 0 && (
                <tr className="bg-teal-950/40 font-semibold text-teal-300">
                  <td className="py-3 pr-4">Plaster &amp; Cement Finish (Inner + Outer + RCC Columns &amp; Side Beams)</td>
                  <td className="py-3 px-4 text-right">{computedResult.plasterEstimate.totalNetPlasterAreaSqFt.toFixed(1)}</td>
                  <td className="py-3 px-4 text-left">sq.ft</td>
                  <td className="py-3 px-4 text-right">—</td>
                  <td className="py-3 pl-4 text-right font-bold text-teal-300">₹{Math.round(computedResult.plasterEstimate.costs.total).toLocaleString('en-IN')}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-8 pt-8 border-t border-gray-800">
            {/* Optional Extra Costs */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Transport Cost (₹)</label>
                  <input type="number" value={transportCost} onChange={e => setTransportCost(Number(e.target.value))} className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Contingency / Tax (%)</label>
                  <input type="number" value={contingencyPercent} onChange={e => setContingencyPercent(Number(e.target.value))} className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm" />
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Brick Masonry Cost</span>
                <span className="text-lg font-semibold text-gray-300">₹{Math.round(computedResult.costs.total + totalLabourCost).toLocaleString('en-IN')}</span>
              </div>
              {computedResult.rccProjectEstimate && computedResult.rccProjectEstimate.costs.total > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-orange-400 font-medium">RCC Structural Cost</span>
                  <span className="text-lg font-semibold text-orange-400">₹{Math.round(computedResult.rccProjectEstimate.costs.total).toLocaleString('en-IN')}</span>
                </div>
              )}
              {computedResult.foundationEstimate && computedResult.foundationEstimate.costs.total > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-amber-400 font-medium">Foundation / Base Cost</span>
                  <span className="text-lg font-semibold text-amber-400">₹{Math.round(computedResult.foundationEstimate.costs.total).toLocaleString('en-IN')}</span>
                </div>
              )}
              {computedResult.plasterEstimate && computedResult.plasterEstimate.costs.total > 0 && (
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-teal-400 font-medium">Plaster & Finish Cost</span>
                  <span className="text-lg font-semibold text-teal-400">₹{Math.round(computedResult.plasterEstimate.costs.total).toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-400">Transport & Extras</span>
                <span className="text-lg font-semibold text-gray-300">₹{Math.round(transportCost + contingencyAmount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end pt-4 border-t border-gray-700 gap-2">
                <div>
                  <span className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-1">Combined Estimate</span>
                  <span className="text-2xl sm:text-3xl font-bold text-orange-500">Final Total Cost</span>
                </div>
                <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight xl:text-right">
                  ₹{Math.round(computedResult.costs.total + totalLabourCost + (computedResult.rccProjectEstimate?.costs.total || 0) + (computedResult.foundationEstimate?.costs.total || 0) + (computedResult.plasterEstimate?.costs.total || 0) + transportCost + contingencyAmount).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Labour Estimate */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden mt-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">👷 Labour Estimate</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="col-span-1 lg:col-span-2">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-gray-500 text-left font-medium tracking-wider text-xs uppercase">
                    <th className="pb-3 pr-4">Labour Type</th>
                    <th className="pb-3 px-4 text-right">Daily Rate</th>
                    <th className="pb-3 px-4 text-right">Estimated Days</th>
                    <th className="pb-3 pl-4 text-right">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  <tr>
                    <td className="py-3 pr-4 font-medium">Mason</td>
                    <td className="py-3 px-4 text-right">₹{masonWage}</td>
                    <td className="py-3 px-4 text-right">{masonDays}</td>
                    <td className="py-3 pl-4 text-right font-semibold text-gray-900">₹{masonCost.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium">Helper</td>
                    <td className="py-3 px-4 text-right">₹{helperWage}</td>
                    <td className="py-3 px-4 text-right">{helperDays}</td>
                    <td className="py-3 pl-4 text-right font-semibold text-gray-900">₹{helperCost.toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-50 font-bold text-gray-900">
                    <td colSpan={3} className="py-3 px-4 text-right border-t border-gray-200">Total Labour Cost</td>
                    <td className="py-3 pl-4 text-right border-t border-gray-200">₹{totalLabourCost.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Editable Defaults */}
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-4">Labour Settings</h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 flex justify-between">
                    <span>Mason Productivity</span>
                    <span className="text-gray-500 font-normal">bricks/day</span>
                  </label>
                  <input type="number" value={masonProductivity} onChange={e => setMasonProductivity(Number(e.target.value))} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Mason Wage (₹)</label>
                    <input type="number" value={masonWage} onChange={e => setMasonWage(Number(e.target.value))} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Helper Wage (₹)</label>
                    <input type="number" value={helperWage} onChange={e => setHelperWage(Number(e.target.value))} className="mt-1 block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-8">
        <button 
          onClick={handleWhatsapp}
          disabled={isWhatsappLoading}
          aria-label="Chat with A V M Bricks on WhatsApp"
          className="inline-flex items-center px-8 py-4 border border-transparent rounded-lg shadow-xl text-lg font-bold text-white bg-orange-600 hover:bg-orange-700 transform transition-transform hover:-translate-y-1 disabled:opacity-80 disabled:hover:-translate-y-0"
        >
          {isWhatsappLoading ? <Loader2 className="h-6 w-6 mr-3 animate-spin" /> : <WhatsAppIcon className="h-6 w-6 mr-3" />} Request a Quote from A V M Bricks
        </button>
      </div>

      <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200 mt-12">
        <div className="flex items-start">
          <AlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5 shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-bold text-yellow-800">Mandatory Safety and Accuracy Disclaimer</h3>
            <div className="mt-2 text-sm text-yellow-700 leading-relaxed space-y-2">
              <p>
                This is an approximate material and labour estimate based on the dimensions, wall layout, openings, selected brick size, mortar ratio, local prices, and reinforcement configurations entered by the user. 
              </p>
              <p className="font-bold text-red-700">
                Concrete pillar locations, sizes, beam reinforcement, slab design, footing, and load-bearing requirements must be designed and approved by a qualified structural/civil engineer. This tool provides an approximate visual layout and material estimate only; it is not a structural design or construction approval.
              </p>
              <p>
                Actual quantities, construction methods, labour requirements, and final costs may vary. Please verify with a qualified civil engineer, contractor, and A V M Bricks representative before ordering or construction.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Project Modal */}
      {buildingModel && (
        <SaveProjectModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          model={buildingModel}
          brickType={brickType}
          settings={settings}
          result={result}
          defaultName={projectName || 'My Construction Plan'}
        />
      )}

      {/* Project History Modal */}
      <ProjectHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
}
