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
          ink: "#071118",
          panel: "#101a22",
          line: "#22313d",
          mint: "#42d392",
          aqua: "#44c7d8",
          amber: "#f0a84b",
          rose: "#ef5b85"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(66, 211, 146, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
