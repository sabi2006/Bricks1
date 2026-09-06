"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Award, Users, Factory, MapPin, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
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
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">About A V M Bricks</h1>
            <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Leading the construction supply industry with decades of excellence, reliable manufacturing processes, and uncompromised quality standards.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        
        {/* Story & Vision */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-900">
              Built on Trust, Strength & Durability
            </h2>
            <p className="text-slate-600 leading-relaxed">
              A V M Bricks is dedicated to producing high-grade clay bricks, wire-cut bricks, and building materials that form the backbone of modern infrastructure. Located in Dindigul, Tamil Nadu, our manufacturing plant utilizes automated machinery alongside time-tested kiln firing techniques.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Whether you are building a dream home, a commercial complex, or executing government infrastructure projects, we deliver consistent dimensions, high compressive strength, and prompt delivery.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="text-slate-800 font-medium">Standard Tested Strength</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="text-slate-800 font-medium">Eco-friendly Process</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="text-slate-800 font-medium">Timely Site Logistics</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <span className="text-slate-800 font-medium">Factory Direct Rates</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-8 md:p-12 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
            <h3 className="text-2xl font-bold mb-6">Our Core Commitment</h3>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Quality Assurance</h4>
                  <p className="text-sm text-slate-400 mt-1">Every batch undergoes rigorous quality checks for density, moisture absorption, and load bearing capacity.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Industry Reliability</h4>
                  <p className="text-sm text-slate-400 mt-1">Supplying hundreds of major contractors, builders, and developers across South India.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 shrink-0 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white">Prompt Logistics</h4>
                  <p className="text-sm text-slate-400 mt-1">Direct fleet delivery to your construction site without delay.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plant Location & Contact Bar */}
        <div className="bg-white border border-border rounded-2xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Visit Our Factory</h3>
              <p className="text-slate-600 text-sm">Chekkath Street, M.M. Kovilur, Dindigul - 624 005, Tamil Nadu</p>
            </div>
          </div>
          <Link href="/bulk-orders">
            <button className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md shadow-primary/20 transition-all whitespace-nowrap">
              Get in Touch
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}
