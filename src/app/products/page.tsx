"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Filter, ChevronDown, Star, ArrowRight } from "lucide-react";

// Demo data for frontend implementation before DB connection
const products = [
  {
    id: "premium-red-brick",
    name: "Premium Red Brick",
    category: "Clay Bricks",
    price: 8.5,
    rating: 4.8,
    reviews: 124,
    image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop",
    features: ["High Compressive Strength", "Low Water Absorption"]
  },
  {
    id: "fly-ash-brick",
    name: "Fly Ash Brick",
    category: "Eco Bricks",
    price: 6.2,
    rating: 4.6,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1621847468516-1ed5d0df56fe?q=80&w=800&auto=format&fit=crop",
    features: ["Lightweight", "Thermal Insulation"]
  },
  {
    id: "solid-concrete-block",
    name: "Solid Concrete Block",
    category: "Concrete Blocks",
    price: 45.0,
    rating: 4.9,
    reviews: 210,
    image: "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?q=80&w=800&auto=format&fit=crop",
    features: ["Heavy Duty", "Load Bearing"]
  },
  {
    id: "hollow-block",
    name: "Hollow Concrete Block",
    category: "Concrete Blocks",
    price: 38.0,
    rating: 4.5,
    reviews: 67,
    image: "https://images.unsplash.com/photo-1590483736622-398541ce0519?q=80&w=800&auto=format&fit=crop",
    features: ["Cost Effective", "Fast Construction"]
  }
];

export default function ProductsPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-slate-900 text-white py-14 md:py-18">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Our Product Catalog
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-slate-300 max-w-2xl mx-auto"
          >
            Explore our premium range of construction materials designed for unmatched strength and durability.
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Filters */}
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-border p-6 sticky top-24">
              <div className="flex items-center gap-2 font-bold text-lg mb-6 pb-4 border-b border-border">
                <Filter className="h-5 w-5 text-primary" /> Filters
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex justify-between items-center">
                    Category <ChevronDown className="h-4 w-4" />
                  </h3>
                  <div className="space-y-2">
                    {["All Products", "Clay Bricks", "Eco Bricks", "Concrete Blocks", "Pavers"].map(cat => (
                      <label key={cat} className="flex items-center gap-2 text-slate-600 hover:text-primary cursor-pointer">
                        <input type="checkbox" className="rounded text-primary focus:ring-primary" defaultChecked={cat === "All Products"} />
                        {cat}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-slate-600 font-medium">Showing {products.length} products</p>
              <select className="bg-white border border-border rounded-lg px-4 py-2 text-slate-700 focus:outline-none focus:border-primary">
                <option>Sort by: Popularity</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Rating</option>
              </select>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((product, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={product.id} 
                  className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all group flex flex-col"
                >
                  <div className="relative h-48 overflow-hidden bg-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-xs font-bold px-2 py-1 rounded shadow-sm text-slate-700">
                      {product.category}
                    </div>
                  </div>
                  
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <Link href={`/products/${product.id}`} className="text-xl font-bold text-slate-900 hover:text-primary transition-colors">
                        {product.name}
                      </Link>
                    </div>
                    
                    <div className="flex items-center gap-1 mb-4">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-slate-700 text-sm">{product.rating}</span>
                      <span className="text-slate-400 text-sm">({product.reviews} reviews)</span>
                    </div>

                    <div className="space-y-1 mb-6 flex-1">
                      {product.features.map(f => (
                        <p key={f} className="text-sm text-slate-600 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/50"></span> {f}
                        </p>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                      <div>
                        <span className="text-xs text-slate-500 block">Starting from</span>
                        <span className="text-xl font-extrabold text-primary">₹{product.price.toFixed(2)}</span>
                        <span className="text-xs text-slate-500">/pc</span>
                      </div>
                      
                      <Link href={`/products/${product.id}`} className="h-10 w-10 bg-slate-100 hover:bg-primary hover:text-white text-slate-700 rounded-full flex items-center justify-center transition-colors">
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
