import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        civic: {
          ink: "#06121f",
          panel: "#0d1b2a",
          line: "#1f3550",
          blue: "#1f89f6",
          sky: "#35aeea",
          mint: "#81fc87",
          aqua: "#35aeea",
          amber: "#f6d500",
          rose: "#ef5b85"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(31, 137, 246, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;