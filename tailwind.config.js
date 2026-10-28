/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy PM Assistant palette. Color carries meaning: dark blue = primary text, header and
        // primary buttons; light blue = borders, secondary text and subtle fills; red = alerts only.
        'legacy-blue-dark': '#003058',
        'legacy-blue-light': '#18385f',
        'legacy-red': '#ee3428',
        // legacy-blue-light at 5% over white as a solid color, for sticky table cells that must be opaque.
        'legacy-tint': '#f3f5f7',
      },
    },
  },
  plugins: [],
};
