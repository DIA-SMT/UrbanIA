import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "urban-canvas": "#f3f6f9",
        civic: {
          ink: "#06121f",
          panel: "#0d1b2a",
          line: "#1f3550",
          blue: "#1f89f6",
          "blue-deep": "#0d6fe0",
          sky: "#35aeea",
          aqua: "#35aeea",
          amber: "#f6d500",
          rose: "#ef5b85"
        }
      },
      fontFamily: {
        display: ["var(--font-manrope)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 40px rgba(31, 137, 246, 0.2)",
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 14px 40px rgba(15, 23, 42, 0.06)",
        "card-hover": "0 2px 4px rgba(15, 23, 42, 0.05), 0 18px 50px rgba(15, 23, 42, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
