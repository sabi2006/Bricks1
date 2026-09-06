"use client";

import { motion } from "framer-motion";
import { UploadCloud, CheckCircle2, Cuboid, ChevronRight, ArrowDown } from "lucide-react";
import Link from "next/link";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

export default function AIVisualEstimatePromoSection() {
  return (
    <section className="py-24 bg-[#FAFAF9] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          {/* Left Column */}
          <motion.div 
            className="w-full lg:w-1/2 flex flex-col"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl lg:text-6xl font-black text-[#111827] leading-[1.1] mb-6">
              Upload Your Plan.<br/>
              See Your Structure.<br/>
              <span className="text-primary">Estimate Your Materials.</span>
            </motion.h2>
            
            <motion.p variants={fadeInUp} className="text-lg text-[#4B5563] leading-relaxed mb-10 max-w-xl">
              Upload a house plan or create your layout manually. Review walls, rooms, doors, and windows, then view an approximate interactive 3D structure and material estimate.
            </motion.p>
            
            <motion.div variants={staggerContainer} className="flex flex-col gap-8 mb-12">
              {/* Step 1 */}
              <motion.div variants={fadeInUp} className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center shrink-0">
                  <UploadCloud className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#111827] mb-1">1. Upload Plan</h4>
                  <p className="text-[#6B7280] text-sm">Drag and drop your 2D floor plan image.</p>
                </div>
              </motion.div>
              
              {/* Step 2 */}
              <motion.div variants={fadeInUp} className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#111827] mb-1">2. Review Layout</h4>
                  <p className="text-[#6B7280] text-sm">Review walls, rooms, doors, and openings before visualizing.</p>
                </div>
              </motion.div>
              
              {/* Step 3 */}
              <motion.div variants={fadeInUp} className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center shrink-0">
                  <Cuboid className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[#111827] mb-1">3. Explore in 3D</h4>
                  <p className="text-[#6B7280] text-sm">View your approximate 3D structure and material estimate.</p>
                </div>
              </motion.div>
            </motion.div>
            
            <motion.div variants={fadeInUp}>
              <Link href="/ai-estimate">
                <button className="w-full sm:w-auto px-8 py-4 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 group shadow-lg hover:shadow-[0_8px_25px_rgba(240,90,0,0.2)] hover:border-primary/50 border border-transparent hover:-translate-y-1">
                  Explore AI Visual Estimate 
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </motion.div>
          </motion.div>
          
          {/* Right Column - 3D Illustration Card */}
          <motion.div 
            className="w-full lg:w-1/2"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative w-full aspect-square md:aspect-[4/5] bg-gradient-to-b from-[#1E293B] to-[#0F172A] rounded-[2rem] border border-[#334155] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col p-8">
              
              {/* Subtle ambient glow */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[40%] bg-primary/20 blur-[100px] pointer-events-none"></div>

              {/* Top: 2D Floor Plan */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="w-full flex-1 bg-[#0F172A]/80 border border-[#334155] rounded-2xl p-6 flex gap-4 relative overflow-hidden"
              >
                {/* Scanning line animation */}
                <motion.div 
                  className="absolute top-0 left-0 w-[200%] h-[150%] bg-gradient-to-b from-transparent via-primary/10 to-transparent -translate-y-full z-10"
                  animate={{ y: ["-100%", "200%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Plan Layout */}
                <div className="flex-1 border-2 border-primary/40 bg-primary/10 rounded-lg transition-colors duration-1000 relative">
                    <div className="absolute inset-x-0 bottom-0 h-1/2 border-t-2 border-primary/40"></div>
                    <div className="absolute inset-y-0 right-1/3 w-0 border-l-2 border-primary/40"></div>
                </div>
                <div className="w-1/3 flex flex-col gap-4">
                  <div className="flex-[0.6] border-2 border-[#475569] bg-[#1E293B]/50 rounded-lg"></div>
                  <div className="flex-1 border-2 border-[#475569] bg-[#1E293B]/50 rounded-lg"></div>
                </div>
              </motion.div>

              {/* Middle: Arrow Badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 1.0 }}
                className="h-16 flex items-center justify-center relative z-20 -my-4"
              >
                <motion.div 
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(240,90,0,0.5)] border-2 border-[#0F172A]"
                >
                  <ArrowDown className="text-white w-6 h-6" />
                </motion.div>
              </motion.div>

              {/* Bottom: 3D Isometric Structure */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 1.2 }}
                className="w-full flex-[1.5] relative flex items-center justify-center perspective-[1000px] mt-4"
              >
                <motion.div 
                  initial={{ rotateX: 65, rotateZ: 40 }}
                  animate={{ rotateZ: [40, 45, 40] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  className="w-[70%] h-[60%] relative"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Glowing Base/Floor */}
                  <div className="absolute inset-0 bg-[#8A3324]/30 border-2 border-primary/60 shadow-[0_0_40px_rgba(240,90,0,0.3)] backdrop-blur-sm rounded-lg"></div>
                  
                  {/* Faux 3D Walls using box-shadows and borders */}
                  {/* Left Outer Wall */}
                  <div 
                    className="absolute top-0 left-0 w-[12%] h-full bg-primary/80 border-r border-white/20 rounded-l-lg shadow-[2px_0_10px_rgba(0,0,0,0.5)]"
                    style={{ transform: 'translateZ(15px)' }}
                  ></div>
                  
                  {/* Top Outer Wall */}
                  <div 
                    className="absolute top-0 left-0 w-full h-[15%] bg-primary/70 border-b border-white/20 rounded-t-lg shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                    style={{ transform: 'translateZ(15px)' }}
                  ></div>
                  
                  {/* Inner Partition Wall */}
                  <div 
                    className="absolute top-0 right-1/3 w-[12%] h-[60%] bg-primary/60 shadow-[-2px_2px_10px_rgba(0,0,0,0.5)] border-x border-b border-white/10 rounded-b-sm"
                    style={{ transform: 'translateZ(15px)' }}
                  ></div>

                  {/* Horizontal Inner Partition */}
                  <div 
                    className="absolute bottom-[25%] left-[12%] w-[55%] h-[15%] bg-primary/60 shadow-[-2px_2px_10px_rgba(0,0,0,0.5)] border-y border-r border-white/10 rounded-r-sm"
                    style={{ transform: 'translateZ(15px)' }}
                  ></div>
                </motion.div>
              </motion.div>
              
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  );
}
