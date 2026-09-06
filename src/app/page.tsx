"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Calculator, Cuboid, Truck, ShieldCheck, CheckCircle2, ChevronRight, Quote, UploadCloud, Eye, BarChart3, Clock, Users, Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import { AnimatePresence } from "framer-motion";


const STICKY_STEPS = [
  {
    title: "Every Strong Structure Starts With One Brick.",
    subtitle: "Manufactured for absolute strength.",
    img: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=1200&auto=format&fit=crop"
  },
  {
    title: "Built for Every Wall. Made for Every Dream.",
    subtitle: "From standard walls to exposed masonry.",
    img: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=1200&auto=format&fit=crop"
  },
  {
    title: "From Brick Quantity to Your Room Preview.",
    subtitle: "Try our advanced calculator to plan perfectly.",
    img: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200&auto=format&fit=crop"
  },
  {
    title: "See Your Project Before You Build It.",
    subtitle: "AI-assisted visual estimation.",
    img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop"
  }
];

function StickyStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const [currentStep, setCurrentStep] = useState(-1);
  
  useEffect(() => {
    return scrollYProgress.onChange((latest) => {
      if (latest <= 0.001) {
        setCurrentStep(-1);
      } else {
        let step = Math.floor(latest * STICKY_STEPS.length);
        if (step >= STICKY_STEPS.length) step = STICKY_STEPS.length - 1;
        setCurrentStep(step);
      }
    });
  }, [scrollYProgress]);

  return (
    <div ref={containerRef} className="relative w-full bg-[#0F172A]" style={{ height: "400vh" }}>
      <div className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center">
        
        {/* Background Images with Crossfade */}
        <div className="absolute inset-0 w-full h-full">
          {STICKY_STEPS.map((step, index) => (
            <motion.div
              key={index}
              className="absolute inset-0 w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: currentStep === index ? 0.6 : 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={step.img} alt={step.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A] via-[#0F172A]/80 to-transparent"></div>
            </motion.div>
          ))}
        </div>

        {/* Text Content */}
        <div className="absolute inset-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
          <AnimatePresence mode="wait">
            {currentStep >= 0 && (
              <motion.div
                key={currentStep}
                className={`w-full h-full flex items-center ${currentStep % 2 !== 0 ? 'justify-end' : 'justify-start'}`}
                initial={{ opacity: 0, x: currentStep % 2 === 0 ? 200 : -200 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: currentStep % 2 === 0 ? -200 : 200 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <div className={`w-full md:w-2/3 lg:w-1/2 pointer-events-auto flex flex-col ${currentStep % 2 !== 0 ? 'items-end text-right' : 'items-start text-left'}`}>
                  <div className="inline-block px-4 py-2 bg-primary/20 backdrop-blur-md text-primary font-bold text-sm rounded-full mb-6 border border-primary/30 shadow-xl">
                    {STICKY_STEPS[currentStep].subtitle}
                  </div>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-8 drop-shadow-xl">
                    {STICKY_STEPS[currentStep].title}
                  </h2>
                  
                  {currentStep === 2 && (
                     <Link href="/calculator" className="w-full sm:w-auto">
                       <button className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(240,90,0,0.39)] hover:bg-[#F97316] transition-all flex items-center justify-center gap-2">
                         Try Advanced Calculator <ArrowRight className="h-5 w-5" />
                       </button>
                     </Link>
                  )}
                  {currentStep === 3 && (
                     <Link href="/ai-estimate" className="w-full sm:w-auto">
                       <button className="w-full sm:w-auto px-8 py-4 bg-white text-[#0F172A] font-bold rounded-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-2 shadow-xl">
                       Upload House Plan <UploadCloud className="h-5 w-5" />
                     </button>
                   </Link>
                )}
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </div>
        
      </div>
    </div>
  );
}

const Hero3DScene = dynamic(() => import("@/components/3d/Hero3DScene"), {
  ssr: false,
});

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: "easeOut" as const }
};

export default function Home() {
  const { scrollYProgress } = useScroll();
  const { scrollY } = useScroll();
  
  // Parallax mappings for hero
  const heroY = useTransform(scrollY, [0, 800], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAF9]">
      
      {/* ============================================================== */}
      {/* 1. HERO SECTION */}
      {/* ============================================================== */}
      <section className="relative h-screen min-h-[800px] flex items-center bg-[#0F172A] overflow-hidden">
        {/* Parallax Background Glow */}
        <motion.div 
          animate={{ x: mousePosition.x * 2, y: mousePosition.y * 2 }}
          className="absolute inset-0 z-0 pointer-events-none opacity-30"
        >
          <div className="absolute top-1/4 right-1/4 w-[800px] h-[800px] bg-primary rounded-full blur-[200px] opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-full h-[50vh] bg-gradient-to-t from-black/60 to-transparent"></div>
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col lg:flex-row h-full">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="w-full lg:w-1/2 flex flex-col justify-center pt-24 lg:pt-0 h-full z-20"
          >
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[1.1] mb-12 drop-shadow-2xl">
              BUILD STRONGER.<br />
              <span className="text-primary">BUILD SMARTER.</span>
            </h1>
            
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <Link href="/products" className="w-full sm:w-auto">
                <button className="w-full px-6 py-3.5 bg-primary hover:bg-[#F97316] text-white rounded-xl font-bold text-base transition-all shadow-[0_4px_20px_0_rgba(240,90,0,0.4)] flex items-center justify-center gap-2 group">
                  Explore Our Bricks 
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="/calculator" className="w-full sm:w-auto">
                <button className="w-full px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold text-base transition-all flex items-center justify-center backdrop-blur-sm">
                  Calculate Your Requirement
                </button>
              </Link>
            </div>
          </motion.div>
          
          <Hero3DScene />
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. SCROLL-DRIVEN STORY */}
      {/* ============================================================== */}
      <StickyStory />

      {/* ============================================================== */}
      {/* 3. KEY BENEFIT CARDS */}
      {/* ============================================================== */}
      <section className="py-24 bg-[#FAFAF9] relative z-10 -mt-10 rounded-t-[3rem] shadow-[0_-20px_40px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Cuboid, title: "Premium Brick Quality", desc: "Reliable bricks designed for strong walls, clean finishing, and long-lasting construction." },
              { icon: Calculator, title: "Accurate Quantity Estimate", desc: "Calculate bricks, mortar, cement, sand, wastage, and estimated project cost." },
              { icon: Eye, title: "360° Structure Preview", desc: "Visualize your room, wall, or building layout in an interactive 3D view." },
              { icon: Truck, title: "Easy Bulk Orders", desc: "Get the right quantity delivered for your construction project seamlessly." }
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                whileHover={{ y: -10 }}
                className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E5E7EB] hover:border-primary/30 hover:shadow-[0_15px_40px_rgba(240,90,0,0.1)] transition-all duration-300 group cursor-default"
              >
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
                  <card.icon className="h-8 w-8 text-primary group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-[#111827]">{card.title}</h3>
                <p className="text-[#6B7280] leading-relaxed text-sm">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 4. PRODUCTS SECTION */}
      {/* ============================================================== */}
      <section className="py-24 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-[#111827] mb-6">The Right Brick<br/>for Every Build.</h2>
            <p className="text-lg text-[#6B7280]">
              Choose the right A V M Bricks product based on your wall type, project requirements, and construction needs.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { name: "Standard Red Brick", size: "9\" x 4.5\" x 3\"", use: "Load bearing walls", price: "Request Price", img: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop" },
              { name: "Wire Cut Brick", size: "9\" x 4\" x 3\"", use: "Exposed masonry", price: "Request Price", img: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?q=80&w=800&auto=format&fit=crop" },
              { name: "Hollow Block", size: "16\" x 8\" x 8\"", use: "Fast construction", price: "Request Price", img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop" }
            ].map((product, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="bg-[#FAFAF9] rounded-3xl overflow-hidden shadow-sm border border-[#E5E7EB] hover:shadow-xl transition-all duration-300 group"
              >
                <div className="relative h-64 overflow-hidden">
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/40 transition-colors z-10" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  
                  {/* Hover Overlay Specs */}
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-4 group-hover:translate-y-0">
                    <span className="text-white font-bold mb-1">Size: {product.size}</span>
                    <span className="text-white/80 text-sm mb-4">Best for: {product.use}</span>
                  </div>
                  
                  <div className="absolute top-4 left-4 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full z-20 shadow-md">
                    Premium Quality
                  </div>
                </div>
                
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-[#111827] mb-4">{product.name}</h3>
                  <div className="flex justify-between items-center mb-8">
                    <span className="text-[#6B7280] font-medium">{product.price}</span>
                  </div>
                  
                  <div className="flex gap-3">
                    <button className="flex-1 py-3 bg-white border border-[#E5E7EB] hover:border-primary text-[#111827] hover:text-primary rounded-xl font-semibold transition-colors text-sm">
                      View Details
                    </button>
                    <button className="flex-1 py-3 bg-primary hover:bg-[#F97316] text-white rounded-xl font-semibold transition-colors text-sm shadow-sm">
                      Use in Calculator
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. ADVANCED CALCULATOR PROMOTION */}
      {/* ============================================================== */}
      <section className="py-28 bg-[#0F172A] relative overflow-hidden">
        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Know What You Need<br/>Before You Order.</h2>
            <p className="text-lg text-white/70">
              Enter your wall, room, compound wall, bathroom, or building dimensions to calculate the estimated bricks, cement, sand, mortar, wastage, and cost.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {["Simple Wall", "Multiple Walls", "Room", "Bathroom", "Compound Wall", "Balcony Wall", "Small Building", "AI House Plan Estimate"].map((cat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ scale: 1.05 }}
                className="bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 text-white p-6 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <Cuboid className="h-8 w-8 text-white/50 group-hover:text-primary transition-colors" />
                <span className="font-semibold text-sm">{cat}</span>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeInUp} className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/calculator">
              <button className="w-full sm:w-auto px-10 py-5 bg-primary hover:bg-[#F97316] text-white rounded-xl font-bold text-lg transition-all shadow-[0_4px_20px_0_rgba(240,90,0,0.4)]">
                Open Brick Calculator
              </button>
            </Link>
            <Link href="/ai-estimate">
              <button className="w-full sm:w-auto px-10 py-5 bg-transparent border border-white/20 hover:bg-white/5 text-white rounded-xl font-bold text-lg transition-all">
                Try AI Visual Estimate
              </button>
            </Link>
          </motion.div>
        </div>
      </section>


      {/* ============================================================== */}
      {/* 7. TRUST AND QUALITY SECTION */}
      {/* ============================================================== */}
      <section className="py-24 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-[#111827] mb-6">Made With Care.<br/>Chosen With <span className="text-primary">Confidence.</span></h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-24">
            {[
              "Quality Checked", "Consistent Dimensions", "Trusted Construction",
              "Bulk Supply Ready", "Expert Support", "Delivery Assistance"
            ].map((badge, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex flex-col items-center text-center p-4"
              >
                <div className="h-16 w-16 bg-[#FAFAF9] rounded-full flex items-center justify-center mb-4 shadow-sm border border-[#E5E7EB]">
                  <ShieldCheck className="h-8 w-8 text-success" />
                </div>
                <span className="font-bold text-sm text-[#111827]">{badge}</span>
              </motion.div>
            ))}
          </div>

          <div className="grid md:grid-cols-4 gap-8 py-12 bg-[#0F172A] rounded-3xl text-white shadow-xl relative overflow-hidden">
             <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none"></div>
            {[
              { label: "Projects Supported", value: "500+" },
              { label: "Bricks Delivered", value: "10M+" },
              { label: "Happy Customers", value: "1,200+" },
              { label: "Years of Experience", value: "15+" }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center relative z-10"
              >
                <div className="text-4xl md:text-5xl font-black text-primary mb-2">{stat.value}</div>
                <div className="text-sm font-semibold text-white/70 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 8. TESTIMONIALS SECTION */}
      {/* ============================================================== */}
      <section className="py-24 bg-[#FAFAF9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-[#111827] mb-6">Trusted by Builders<br/>and Home Owners.</h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-[#E5E7EB] relative"
              >
                <Quote className="absolute top-8 right-8 h-8 w-8 text-[#F5EEE6]" />
                <div className="flex gap-1 mb-6">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-[#6B7280] italic mb-8 relative z-10 leading-relaxed">
                  “A V M Bricks helped us estimate the correct brick quantity for our house construction. The calculator was incredibly easy to use and the quality of the bricks delivered was phenomenal.”
                </p>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-[#F5EEE6] rounded-full flex items-center justify-center">
                    <span className="font-bold text-primary">JD</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#111827]">John Doe</h4>
                    <p className="text-xs text-[#6B7280]">Home Construction Project</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 9. FINAL CTA SECTION */}
      {/* ============================================================== */}
      <section className="relative py-32 bg-[#0F172A] overflow-hidden">
        {/* Subtle Brick Texture Background */}
        <div className="absolute inset-0 opacity-5">
           <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="brick-pattern" width="60" height="30" patternUnits="userSpaceOnUse">
                  <rect width="60" height="30" fill="#0F172A" />
                  <rect x="0" y="0" width="28" height="13" fill="#ffffff" rx="2" />
                  <rect x="30" y="0" width="28" height="13" fill="#ffffff" rx="2" />
                  <rect x="-15" y="15" width="28" height="13" fill="#ffffff" rx="2" />
                  <rect x="15" y="15" width="28" height="13" fill="#ffffff" rx="2" />
                  <rect x="45" y="15" width="28" height="13" fill="#ffffff" rx="2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#brick-pattern)" />
            </svg>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl md:text-7xl font-black text-white mb-6"
          >
            Ready to Build<br/>Something <span className="text-primary">Strong?</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/80 mb-12"
          >
            Choose quality bricks, calculate your requirement, and get expert support for your project.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row justify-center gap-4"
          >
            <Link href="/calculator">
              <button className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-[#F97316] text-white rounded-xl font-bold text-lg transition-all shadow-[0_4px_20px_0_rgba(240,90,0,0.4)]">
                Calculate Bricks Now
              </button>
            </Link>
            <Link href="/bulk-orders">
              <button className="w-full sm:w-auto px-8 py-4 bg-white text-[#111827] hover:bg-gray-100 rounded-xl font-bold text-lg transition-all">
                Get a Quote
              </button>
            </Link>
            <Link href="/contact">
              <button className="w-full sm:w-auto px-8 py-4 bg-transparent border border-white/20 hover:bg-white/10 text-white rounded-xl font-bold text-lg transition-all">
                Contact A V M Bricks
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

    </div>
  );
}
