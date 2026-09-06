import { MapPin, Phone, Mail, Clock } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          {/* Brand Info */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-primary text-white p-1.5 rounded-lg">
                <div className="h-5 w-5 font-bold flex justify-center items-center">A</div>
              </div>
              <span className="font-bold text-xl tracking-wide flex items-center gap-1.5">
                <span className="text-white">A V M</span>
                <span className="text-primary">Bricks</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-6">
              Premium quality brick manufacturer supplying top-grade construction materials to builders, contractors, and home owners across the country.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <span>Chekkath Street, M.M. Kovilur,<br/>Dindigul - 624 005, Tamil Nadu</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary shrink-0" />
                <span>+91 97913 16101 / 97514 90074</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <span>sales@avmbricks.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-6">Quick Links</h3>
            <ul className="space-y-4 text-sm">
              <li><Link href="/products" className="hover:text-primary transition-colors">Products</Link></li>
              <li><Link href="/calculator" className="hover:text-primary transition-colors">Brick Calculator</Link></li>
              <li><Link href="/bulk-orders" className="hover:text-primary transition-colors">Bulk Orders</Link></li>
              <li><Link href="/about" className="hover:text-primary transition-colors">About</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-semibold mb-6">Contact</h3>
            <ul className="space-y-4 text-sm">
              <li><a href="tel:+919791316101" className="hover:text-primary transition-colors flex items-center gap-2"><Phone className="h-4 w-4" /> Phone</a></li>
              <li><a href="mailto:sales@avmbricks.com" className="hover:text-primary transition-colors flex items-center gap-2"><Mail className="h-4 w-4" /> Email</a></li>
              <li><a href="https://maps.google.com" className="hover:text-primary transition-colors flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</a></li>
              <li><a href="https://wa.me/919791316101" className="hover:text-primary transition-colors flex items-center gap-2 text-green-500">WhatsApp</a></li>
            </ul>
          </div>

          {/* Social Links & Policies */}
          <div>
            <h3 className="text-white font-semibold mb-6">Socials & Policies</h3>
            <ul className="space-y-4 text-sm">
              <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-primary transition-colors">Terms and Conditions</Link></li>
            </ul>
          </div>

        </div>
      </div>
      
      {/* Bottom Bar */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-center items-center text-xs">
          <p>© {new Date().getFullYear()} A V M Bricks. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
