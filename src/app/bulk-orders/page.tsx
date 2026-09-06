"use client";

import { motion } from "framer-motion";
import { Building2, MessageSquare, Briefcase, FileCheck, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}>
    <path d="M11.99 0C5.367 0 0 5.366 0 11.99c0 2.12.553 4.17 1.603 5.986L.045 24l6.195-1.624C8.01 23.336 9.974 23.98 11.99 23.98 18.614 23.98 24 18.614 24 11.99 24 5.366 18.614 0 11.99 0zm0 21.986c-1.802 0-3.567-.483-5.113-1.397l-.367-.216-3.805.998.997-3.708-.237-.378C2.518 15.698 1.993 13.86 1.993 11.99 1.993 6.467 6.467 1.993 11.99 1.993 17.514 1.993 22.007 6.468 22.007 11.99c0 5.522-4.493 9.996-10.017 9.996zm5.495-7.483c-.302-.15-1.787-.882-2.062-.983-.275-.1-.475-.15-.675.15s-.775.983-.95 1.183c-.175.2-.35.225-.65.075-2.008-1-3.64-2.825-4.225-3.833-.175-.3-.025-.462.125-.612.133-.133.302-.35.452-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.242-.584-.488-.505-.675-.514-.175-.008-.375-.008-.575-.008-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.113 3.225 5.113 4.525.713.313 1.263.5 1.7.638.712.225 1.362.187 1.875.112.575-.087 1.787-.725 2.037-1.425.25-.7.25-1.3.175-1.425-.075-.125-.275-.2-.575-.35z"/>
  </svg>
);

export default function BulkOrdersPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);

  const handleWhatsappClick = () => {
    setIsWhatsappLoading(true);
    setTimeout(() => {
      window.open('https://wa.me/919791316101?text=Hello%20A%20V%20M%20Bricks%2C%20I%20need%20assistance%20with%20your%20bricks%20and%20construction%20estimate.', '_blank', 'noopener,noreferrer');
      setIsWhatsappLoading(false);
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-slate-900 text-white py-14 md:py-18">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6">Bulk Order Quotation</h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Are you a builder, contractor, or dealer? Request a custom quotation for high-volume orders and get our best factory-direct B2B pricing.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-5 gap-12 items-start">
          
          {/* Information Column */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-border p-8">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Why Partner With Us?</h3>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Factory Direct Pricing</h4>
                    <p className="text-sm text-slate-600 mt-1">Eliminate middlemen and get our absolute best rates directly from our manufacturing plant.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Priority Manufacturing</h4>
                    <p className="text-sm text-slate-600 mt-1">Large orders receive priority in our production schedule to ensure you meet your project deadlines.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">Dedicated Account Manager</h4>
                    <p className="text-sm text-slate-600 mt-1">Get a single point of contact for order tracking, dispatch updates, and billing support via WhatsApp.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <h3 className="text-xl font-bold mb-2">Need immediate assistance?</h3>
              <p className="text-slate-300 text-sm mb-6">Our B2B sales team is available 24/7 on WhatsApp.</p>
              <button 
                onClick={handleWhatsappClick}
                disabled={isWhatsappLoading}
                aria-label="Chat with A V M Bricks on WhatsApp"
                className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-80"
              >
                {isWhatsappLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <WhatsAppIcon className="h-5 w-5" />}
                Chat on WhatsApp
              </button>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-3">
            {isSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center"
              >
                <div className="h-20 w-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">Request Submitted Successfully!</h3>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  Thank you for your interest. Our B2B sales team has received your requirements and will contact you with a customized quotation within 24 hours.
                </p>
                <button onClick={() => setIsSubmitted(false)} className="text-primary font-bold hover:underline">
                  Submit another request
                </button>
              </motion.div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-border p-8 md:p-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Company / Builder Name *</label>
                      <input required type="text" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Enter company name" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Person *</label>
                      <input required type="text" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Your full name" />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number *</label>
                      <input required type="tel" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="+91" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                      <input type="email" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="sales@yourcompany.com" />
                    </div>
                  </div>

                  <div className="border-t border-border pt-6 mt-6">
                    <h4 className="font-bold text-slate-900 mb-4">Requirement Details</h4>
                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Product Required *</label>
                        <select required className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all">
                          <option value="">Select a product...</option>
                          <option>Premium Red Bricks</option>
                          <option>Fly Ash Bricks</option>
                          <option>Solid Concrete Blocks</option>
                          <option>Hollow Concrete Blocks</option>
                          <option>Interlocking Pavers</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Estimated Quantity *</label>
                        <input required type="number" min="5000" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Min. 5000 units" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Delivery Location (City/Pincode) *</label>
                      <input required type="text" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Where should we deliver?" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Additional Requirements / Project Details</label>
                    <textarea rows={4} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Tell us about your timeline, unloading requirements, or any specific specifications..."></textarea>
                  </div>

                  <button type="submit" className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.01]">
                    Submit Request <ArrowRight className="h-5 w-5" />
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-4">By submitting this form, you agree to our privacy policy. Your data is secure.</p>
                </form>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// Missing icon used in state
const CheckCircle2 = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
