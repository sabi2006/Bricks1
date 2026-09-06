"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, ShoppingCart, User, Search, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Products", href: "/products" },
    { name: "Brick Calculator", href: "/calculator" },
    { name: "Bulk Orders", href: "/bulk-orders" },
    { name: "About Us", href: "/about" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0F172A] shadow-[0_4px_30px_rgba(0,0,0,0.1)] py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent pointer-events-none -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-3 group">
                <span className="font-black text-xl md:text-2xl tracking-wide flex items-center gap-1.5">
                  <span className="text-white">A V M</span>
                  <span className="text-primary">Bricks</span>
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-6">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="relative py-2 text-[15px] font-medium transition-colors group flex items-center"
                  >
                    <span className={isActive ? "text-primary font-bold" : "text-white/80 group-hover:text-primary transition-colors"}>
                      {link.name}
                    </span>
                    
                    {/* Animated Underline */}
                    {isActive ? (
                      <motion.div
                        layoutId="navbar-active"
                        className="absolute -bottom-1 left-0 right-0 h-[2px] bg-primary rounded-full"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    ) : (
                      <div className="absolute -bottom-1 left-0 right-0 h-[2px] bg-primary rounded-full scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300 ease-out" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right Side Actions */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* Search */}
              <button className="p-2 text-white/80 hover:text-primary transition-colors">
                <Search className="h-5 w-5" />
              </button>
              
              {/* Cart */}
              <Link href="/cart" className="relative p-2 text-white/80 hover:text-primary transition-colors flex items-center">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  2
                </span>
              </Link>
              
              {/* Profile */}
              <button className="p-2 text-white/80 hover:text-primary transition-colors">
                <User className="h-5 w-5" />
              </button>

              {/* CTA Button */}
              <div className="pl-4 ml-2 border-l border-white/10 flex items-center">
                <Link href="/bulk-orders">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-primary hover:bg-[#F97316] text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-[0_4px_14px_0_rgba(240,90,0,0.39)] transition-all flex items-center justify-center"
                  >
                    Get a Free Quote
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center space-x-3">
              <Link href="/cart" className="relative text-slate-300 p-2">
                <ShoppingCart className="h-6 w-6" />
                <span className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-slate-900">2</span>
              </Link>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-white p-2 hover:bg-white/10 rounded-lg focus:outline-none transition-colors"
              >
                {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-900 pt-24 px-6 overflow-y-auto lg:hidden"
          >
            <div className="flex flex-col space-y-6 max-w-lg mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-white placeholder-slate-400"
                />
              </div>

              <nav className="flex flex-col space-y-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`text-xl font-bold p-4 rounded-xl transition-colors ${
                      pathname === link.href 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-white hover:bg-white/5"
                    }`}
                  >
                    {link.name}
                  </Link>
                ))}
              </nav>

              <div className="h-px bg-white/10 w-full my-4"></div>

              <div className="flex flex-col gap-4 pb-8">
                <Link 
                  href="/login" 
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 p-4 text-slate-300 font-medium hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors"
                >
                  <User className="h-6 w-6 text-slate-400" /> Account & Orders
                </Link>
                
                <Link href="/bulk-orders" onClick={() => setIsOpen(false)}>
                  <button className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20">
                    Get a Free Quote
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
