import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05070b",
        ki: "#27b3ff",
        ssj: "#ffd84d",
        crimson: "#ff335f",
        ui: "#f2f5ff"
      },
      boxShadow: {
        ki: "0 0 45px rgba(39,179,255,.35)",
        ssj: "0 0 45px rgba(255,216,77,.25)"
      }
    }
  },
  plugins: []
} satisfies Config;
