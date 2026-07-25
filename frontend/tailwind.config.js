/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FBF6EC",
        forest: {
          DEFAULT: "#1B4332",
          light: "#2D6A4F",
          dark: "#0F2E22",
        },
        turmeric: {
          DEFAULT: "#E8A33D",
          dark: "#C9821F",
        },
        ink: "#20241F",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
