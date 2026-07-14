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
        // Design system tokens — all read from CSS variables so the theme
        // toggle just flips [data-theme] on <html> and every token updates.
        canvas:   "var(--color-canvas)",
        surface:  "var(--color-surface)",
        card:     "var(--color-card)",
        hairline: "var(--color-hairline)",
        primary:  "var(--color-primary)",
        muted:    "var(--color-muted)",
        gain:     "var(--color-gain)",
        loss:     "var(--color-loss)",
        accent:   "var(--color-accent)",
      },
      fontFamily: {
        sans:    ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
