"use client";

import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef } from "react";

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<any>(null);

  useEffect(() => {
    let lenis: any = null;
    let rafId: number;

    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({
        lerp: 0.08,
        duration: 1.2,
        smoothWheel: true,
      });
      lenisRef.current = lenis;

      function raf(time: number) {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }

      rafId = requestAnimationFrame(raf);
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (lenis) {
        lenis.destroy();
        lenisRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return <>{children}</>;
}

