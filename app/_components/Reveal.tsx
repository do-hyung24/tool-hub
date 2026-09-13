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

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    // 마운트 시점에 이미 뷰포트 안에 있으면 옵저버 발화를 기다리지 않고 바로 보여준다.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setIsVisible(true);
      return;
    }

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

    // 옵저버가 어떤 이유로든 발화하지 않는 경우를 대비한 안전장치.
    const fallback = window.setTimeout(() => setIsVisible(true), 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div ref={ref} className={`lp-fade-up ${isVisible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
