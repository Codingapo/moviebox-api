"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";

const EnergyScene = dynamic(() => import("./three/energy-scene"), { ssr: false });

export default function Hero() {
  const reduced = useReducedMotion();
  return (
    <section className="energy-grid relative min-h-[92vh] overflow-hidden border-b border-white/10">
      {!reduced && <EnergyScene />}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,transparent_0,rgba(5,7,11,.08)_30%,rgba(5,7,11,.85)_72%)]" />
      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl items-center px-6">
        <div className="max-w-3xl">
          <motion.p initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="mb-4 text-sm font-bold uppercase tracking-[.35em] text-ki">
            Enter the energy field
          </motion.p>
          <motion.h1 initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:.08}} className="glow-text text-5xl font-black uppercase leading-[.9] sm:text-7xl lg:text-8xl">
            Power up your anime universe.
          </motion.h1>
          <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.18}} className="mt-6 max-w-xl text-base leading-7 text-white/70 sm:text-lg">
            Real anime data. Cinematic browsing. Watch history, comments, lists and a playful power-level system built for speed.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#latest" className="rounded-full bg-ki px-6 py-3 font-bold text-black shadow-ki transition hover:scale-[1.03]">Start watching</a>
            <a href="#genres" className="rounded-full border border-white/15 bg-white/5 px-6 py-3 font-bold backdrop-blur hover:bg-white/10">Browse genres</a>
          </div>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 text-xs uppercase tracking-[.3em] text-white/50">Scroll to power up ↓</div>
    </section>
  );
}
