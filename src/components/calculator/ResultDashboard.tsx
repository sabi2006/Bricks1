"use client";

import { useCalculator } from "./CalculatorContext";
import { ArrowRight, Save, Share2, Download, AlertCircle } from "lucide-react";
import Link from "next/link";
import { WallPreview } from "./VisualPreviews";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
    <path d="M11.99 0C5.367 0 0 5.366 0 11.99c0 2.12.553 4.17 1.603 5.986L.045 24l6.195-1.624C8.01 23.336 9.974 23.98 11.99 23.98 18.614 23.98 24 18.614 24 11.99 24 5.366 18.614 0 11.99 0zm0 21.986c-1.802 0-3.567-.483-5.113-1.397l-.367-.216-3.805.998.997-3.708-.237-.378C2.518 15.698 1.993 13.86 1.993 11.99 1.993 6.467 6.467 1.993 11.99 1.993 17.514 1.993 22.007 6.468 22.007 11.99c0 5.522-4.493 9.996-10.017 9.996zm5.495-7.483c-.302-.15-1.787-.882-2.062-.983-.275-.1-.475-.15-.675.15s-.775.983-.95 1.183c-.175.2-.35.225-.65.075-2.008-1-3.64-2.825-4.225-3.833-.175-.3-.025-.462.125-.612.133-.133.302-.35.452-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.242-.584-.488-.505-.675-.514-.175-.008-.375-.008-.575-.008-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.113 3.225 5.113 4.525.713.313 1.263.5 1.7.638.712.225 1.362.187 1.875.112.575-.087 1.787-.725 2.037-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
  </svg>
);

export default function ResultDashboard() {
  const { mode, result, difficulty, settings, hasCalculated, brickType } = useCalculator();
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);

  const handleWhatsapp = () => {
    setIsWhatsappLoading(true);
    const msg = `Hello A V M Bricks, I need a quote.

Project Type: ${mode} Construction
Estimated Bricks: ${result?.totalBricks.toLocaleString()}
Selected Brick: ${brickType?.name || 'Standard Brick'}
Estimated Material Cost: ₹${result?.costs.total.toLocaleString()}

Please contact me.`;
    
    setTimeout(() => {
      window.open(`https://wa.me/919791316101?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      setIsWhatsappLoading(false);
    }, 400);
  };

  if (!result || !hasCalculated) return null;

  return (
    <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-6 md:p-8 text-white sticky top-24">
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">Your Project Summary</h2>
          <p className="text-slate-400 text-sm mt-1 capitalize">Project Type: {mode} Construction</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        
        {/* Wall Preview */}
        <WallPreview />

        {/* Main Result */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 text-center">
          <p className="text-primary-foreground/80 text-xs font-semibold mb-1 uppercase tracking-wide">Standard TN Red Brick (230 × 115 × 75 mm)</p>
          <div className="flex items-end justify-center gap-2 my-2">
            <span className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">{result.totalBricks.toLocaleString()}</span>
            <span className="text-xl text-slate-300 font-medium pb-1.5">bricks</span>
          </div>
          <div className="flex justify-center items-center gap-4 text-xs text-slate-400 font-medium">
            <span>Base: {result.baseBrickQuantity.toLocaleString()}</span>
            <span className="h-1 w-1 bg-slate-600 rounded-full"></span>
            <span>Wastage ({settings.wastagePercentage}%): +{result.wastageBricks.toLocaleString()}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-primary/20 flex justify-between items-center text-xs px-2">
            <span className="text-slate-300">Brick Cost (@ ₹{settings.brickPrice || 8.5}/pc):</span>
            <span className="font-bold text-orange-400 font-mono text-sm">₹{result.costs.bricks.toLocaleString()}</span>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <p className="text-xs text-slate-400 font-semibold mb-1">Net Wall Area</p>
            <p className="text-lg font-bold text-white">{(result.netWallArea * 10.7639).toFixed(1)} <span className="text-xs font-normal text-slate-300">sq.ft</span></p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{result.netWallArea.toFixed(2)} m²</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5">
            <p className="text-xs text-slate-400 font-semibold mb-1">Net Wall Volume</p>
            <p className="text-lg font-bold text-white">{(result.netWallVolume * 35.3147).toFixed(1)} <span className="text-xs font-normal text-slate-300">cu.ft (CFT)</span></p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{result.netWallVolume.toFixed(2)} m³</p>
          </div>
        </div>

        {/* RCC Structural Construction (Pillars / Beams / Slabs) */}
        {result.rccProjectEstimate && result.rccProjectEstimate.totalConcreteVolumeM3 > 0 && (
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-orange-400 flex items-center gap-1.5">
                <span>🏗️</span> RCC Structural Estimate
              </h4>
              <span className="text-xs font-mono font-bold text-orange-300">
                {result.rccProjectEstimate.totalConcreteVolumeCft.toFixed(1)} CFT ({result.rccProjectEstimate.totalConcreteVolumeM3.toFixed(2)} m³)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">TMT Steel</p>
                <p className="text-sm font-bold text-white font-mono">{result.rccProjectEstimate.totalSteelKg.toFixed(1)} kg</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Cement</p>
                <p className="text-sm font-bold text-white font-mono">{result.rccProjectEstimate.totalCementBags} bags</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">20mm Jalli</p>
                <p className="text-sm font-bold text-white font-mono">{result.rccProjectEstimate.totalAggregateCft.toFixed(1)} CFT</p>
              </div>
            </div>

            <div className="flex justify-between items-center px-3 py-2 bg-orange-950/30 border border-orange-500/20 rounded-lg text-xs">
              <span className="text-slate-300">RCC Construction Cost</span>
              <span className="font-bold text-orange-400 font-mono">₹{Math.round(result.rccProjectEstimate.costs.total).toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

        {/* Plaster Surface Estimate */}
        {result.plasterEstimate && result.plasterEstimate.totalNetPlasterAreaSqFt > 0 && (
          <div className="pt-4 border-t border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-teal-400 flex items-center gap-1.5">
                <span>🎨</span> Plaster / Rendering Estimate
              </h4>
              <span className="text-xs font-mono font-bold text-teal-300">
                {result.plasterEstimate.totalNetPlasterAreaSqFt.toFixed(1)} sq.ft
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Cement</p>
                <p className="text-xs font-bold text-teal-300 font-mono">{result.plasterEstimate.totalCementBags.toFixed(1)} bags</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Sand</p>
                <p className="text-xs font-bold text-amber-300 font-mono">{result.plasterEstimate.totalSandCft.toFixed(1)} CFT</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-0.5">Cost</p>
                <p className="text-xs font-bold text-teal-300 font-mono">₹{Math.round(result.plasterEstimate.costs.total).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Estimation (Mortar/Cement) */}
        {difficulty === 'advanced' && (
          <div className="pt-4 border-t border-white/10 space-y-3">
            <h4 className="text-sm font-semibold text-slate-300 mb-2">Mortar & Material Estimate</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-1">Mortar</p>
                <p className="text-sm font-bold text-white">{result.wetMortarVolume.toFixed(2)} m³</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-1">Cement</p>
                <p className="text-sm font-bold text-white">{result.cementBags.toLocaleString()} bags</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400 uppercase mb-1">Sand</p>
                <p className="text-sm font-bold text-white">{result.sandVolume.toFixed(2)} m³</p>
              </div>
            </div>
            
            {/* Cost Estimate */}
            <div className="mt-4 bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-400">Total Estimated Cost</span>
                <span className="text-xl font-bold text-green-400">
                  ₹{Math.round(result.costs.total + (result.rccProjectEstimate?.costs.total || 0) + (result.plasterEstimate?.costs.total || 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="space-y-1 text-xs text-slate-500">
                <div className="flex justify-between"><span>Bricks:</span> <span>₹{result.costs.bricks.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Mortar Cement:</span> <span>₹{result.costs.cement.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Mortar Sand:</span> <span>₹{result.costs.sand.toLocaleString()}</span></div>
                {result.rccProjectEstimate && result.rccProjectEstimate.costs.total > 0 && (
                  <div className="flex justify-between text-orange-400 font-medium"><span>RCC Structural:</span> <span>₹{Math.round(result.rccProjectEstimate.costs.total).toLocaleString('en-IN')}</span></div>
                )}
                {result.plasterEstimate && result.plasterEstimate.costs.total > 0 && (
                  <div className="flex justify-between text-teal-400 font-medium"><span>Plaster / Finish:</span> <span>₹{Math.round(result.plasterEstimate.costs.total).toLocaleString('en-IN')}</span></div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Warning / Disclaimer */}
        <div className="flex items-start gap-3 bg-slate-800/80 border border-slate-700 p-4 rounded-xl text-slate-400 text-[10px] leading-relaxed">
          <AlertCircle className="h-5 w-5 shrink-0 text-primary" />
          <p>
            <b>Important:</b> This calculator and 3D structure view provide an approximate estimate based on the dimensions, brick size, mortar joint, openings, and assumptions entered by the customer. It is not an engineering drawing, structural plan, load-bearing calculation, or construction approval. Final construction dimensions and material quantities must be verified by a qualified civil engineer, architect, or contractor.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <button 
            onClick={handleWhatsapp}
            aria-label="Chat with A V M Bricks on WhatsApp"
            disabled={isWhatsappLoading}
            className="w-full py-3.5 bg-primary hover:bg-[#F97316] text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-80"
          >
            {isWhatsappLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WhatsAppIcon className="h-4 w-4" />}
            Request Quote from A V M Bricks
          </button>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'A V M Bricks Estimate',
                    text: `Project Estimate: ${result.totalBricks.toLocaleString()} bricks needed.`,
                    url: window.location.href,
                  }).catch(console.error);
                } else {
                  alert('Sharing is not supported on this browser.');
                }
              }}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="h-3.5 w-3.5" /> Share Estimate
            </button>
            <button 
              onClick={() => window.print()}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="h-3.5 w-3.5" /> Download Estimate PDF
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
