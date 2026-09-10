"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// 스크롤 진입 시 서서히 떠오르는 효과(app/globals.css의 .lp-fade-up)를 트리거한다.
// 한 번 보이면 다시 숨기지 않는다(observer는 그 시점에 끊는다).
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`lp-fade-up ${isVisible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
