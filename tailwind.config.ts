import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EAE7DE",
        ink: "#262521",
        "ink-soft": "#55534c",
        moss: "#5C6E58",
        mist: "#8B9A94",
        line: "#d8d4c8",
        fail: "#b5544a",
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
