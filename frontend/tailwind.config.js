export default {
  content: ["./index.html","./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1D4ED8",   // hospital blue
          primary2:"#2563EB",
          light:   "#E6F0FF",
          dark:    "#0B3C8A",
          accent:  "#06B6D4",   // cyan
        }
      },
      boxShadow: {
        soft: "0 10px 25px -10px rgba(29,78,216,0.25)"
      },
      borderRadius: { xl2: "1.25rem" }
    }
  },
  plugins: []
};
