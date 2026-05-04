import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        paper: "#f5f1e8",
        accent: "#ff3366",
      },
    },
  },
  plugins: [],
} satisfies Config;
