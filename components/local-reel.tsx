"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Clock } from "lucide-react";

const YELLOW = "#F5A623";
const WATERMELON = "#E63950";

export function LocalReel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2, rootMargin: "0px 0px -80px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden" style={{ background: "#0D0000" }}>
      <div className={`reel-frame relative w-full h-[62vh] md:h-[78vh] ${visible ? "visible" : ""}`}>
        <video
          ref={videoRef}
          className="video-kenburns absolute inset-0 w-full h-full object-cover"
          src="/videos/local-vargas-machuca.mp4"
          poster="/videos/local-vargas-machuca-poster.jpg"
          muted
          loop
          playsInline
          preload="none"
        />

        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(13,0,0,0.05) 0%, rgba(13,0,0,0.35) 55%, rgba(13,0,0,0.92) 100%)" }}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-end px-6 pb-12 md:pb-16 text-center gap-3">
          <h2 className="font-bebas tracking-widest text-white leading-none" style={{ fontSize: "clamp(40px,8vw,80px)" }}>
            NUESTRO <span style={{ color: YELLOW }}>LOCAL</span>
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: WATERMELON, color: "#fff" }}
            >
              <MapPin size={14} />
              Av. Vargas Machuca, SJM
            </span>
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.4)", color: YELLOW }}
            >
              <Clock size={14} />
              Lun-Dom 12pm-11pm
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
