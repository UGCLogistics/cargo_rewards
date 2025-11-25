/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: "#ff4600",
        cargo: {
          bg: "#0d121a",
          surface: "rgba(255, 255, 255, 0.05)",
          border: "rgba(255, 255, 255, 0.12)",
        },
      },
    },
  },
  plugins: [],
};
