import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Design system tokens
        canvas:   "#0B0E14",
        surface:  "#12161F",
        card:     "#1B2130",
        hairline: "#232838",
        primary:  "#E6E9EF",
        muted:    "#8B93A7",
        gain:     "#2FBE85",
        loss:     "#F0526B",
        accent:   "#D9A94D",
        // keep old background/foreground vars for any legacy usage
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans:  ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        mono:  ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
