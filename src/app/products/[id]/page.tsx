"use client";

import { useState } from "react";
import Link from "next/link";
import { use } from "react";
import { Star, Truck, ShieldCheck, CheckCircle2, ChevronRight, Share2, Plus, Minus, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Extract id from params Promise (Next.js 15 structure)
  const resolvedParams = use(params);
  const [quantity, setQuantity] = useState(1000);

  // Mock product logic based on ID
  const product = {
    id: resolvedParams.id,
    name: resolvedParams.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    price: 8.50,
    rating: 4.8,
    reviews: 124,
    stock: "In Stock",
    minOrder: 500,
    description: "Our premium bricks are manufactured using state-of-the-art extrusion technology, ensuring perfect shape, high compressive strength, and low water absorption. Ideal for both structural walls and beautiful exposed brickwork.",
    specs: {
      Dimensions: "230 x 110 x 75 mm",
      Weight: "3.2 kg",
      "Compressive Strength": "> 10 N/mm²",
      "Water Absorption": "< 15%",
      Material: "Premium Clay",
      Color: "Natural Terracotta Red"
    },
    images: [
      "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=1200&auto=format&fit=crop"
    ]
  };

  const handleQuantityChange = (val: number) => {
    if (val >= product.minOrder) {
      setQuantity(val);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-10 md:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/products" className="hover:text-primary">Products</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-slate-900 font-medium">{product.name}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 md:p-10">
          <div className="grid md:grid-cols-2 gap-12">
            
            {/* Image Gallery */}
            <div>
              <div className="rounded-xl overflow-hidden bg-slate-100 aspect-[4/3] relative mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={product.images[0]} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Product Details */}
            <div className="flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">{product.name}</h1>
                <button className="text-slate-400 hover:text-primary bg-slate-50 p-2 rounded-full transition-colors">
                  <Share2 className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-slate-900">{product.rating}</span>
                </div>
                <Link href="#reviews" className="text-primary hover:underline text-sm font-medium">
                  {product.reviews} Reviews
                </Link>
                <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium bg-emerald-50 px-2 py-1 rounded">
                  <CheckCircle2 className="h-4 w-4" /> {product.stock}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900">₹{product.price.toFixed(2)}</span>
                  <span className="text-slate-500">/ piece</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Inclusive of all taxes. Delivery calculated at checkout.</p>
              </div>

              <p className="text-slate-600 leading-relaxed mb-8">
                {product.description}
              </p>

              <div className="border-t border-border pt-6 mt-auto">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  {/* Quantity Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-700">Quantity (Min: {product.minOrder})</label>
                    <div className="flex items-center bg-slate-100 rounded-lg border border-border w-fit overflow-hidden">
                      <button 
                        onClick={() => handleQuantityChange(quantity - 100)}
                        className="px-4 py-3 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input 
                        type="number"
                        value={quantity}
                        onChange={(e) => handleQuantityChange(Number(e.target.value))}
                        className="w-24 text-center bg-transparent font-bold text-slate-900 focus:outline-none"
                        min={product.minOrder}
                      />
                      <button 
                        onClick={() => handleQuantityChange(quantity + 100)}
                        className="px-4 py-3 hover:bg-slate-200 text-slate-600 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button className="flex-1 py-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02]">
                    <ShoppingCart className="h-5 w-5" /> Add to Cart
                  </button>
                  <Link href="/bulk-orders" className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]">
                    Request Bulk Quote
                  </Link>
                </div>
              </div>
              
              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Truck className="h-8 w-8 text-slate-400" />
                  <span>Site Delivery<br/><strong className="text-slate-900">Within 24-48 hours</strong></span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <ShieldCheck className="h-8 w-8 text-slate-400" />
                  <span>Quality Assured<br/><strong className="text-slate-900">100% Tested</strong></span>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Specifications Tab */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="border-b border-border bg-slate-50 px-8 py-4">
            <h2 className="text-xl font-bold text-slate-900">Technical Specifications</h2>
          </div>
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-4">
              {Object.entries(product.specs).map(([key, value]) => (
                <div key={key} className="flex justify-between py-3 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500 font-medium">{key}</span>
                  <span className="text-slate-900 font-bold text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
