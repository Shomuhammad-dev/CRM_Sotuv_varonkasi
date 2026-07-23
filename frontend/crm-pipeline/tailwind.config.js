/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"] },
      animation: {
        "in": "fadeSlideIn 0.2s ease",
      },
      keyframes: {
        fadeSlideIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
