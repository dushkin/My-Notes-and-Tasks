// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          css: {
            'h1': {
              color: theme('colors.sky.700'),
            },
            'h2': {
              color: theme('colors.sky.600'),
            },
            'h3': {
              color: theme('colors.sky.500'),
            },
            'strong': {
              color: theme('colors.indigo.600'),
            },
            'a': {
              color: theme('colors.emerald.600'),
              '&:hover': {
                color: theme('colors.emerald.700'),
              },
            },
          },
        },
        invert: { // For dark mode
          css: {
            'h1': {
              color: theme('colors.sky.300'),
            },
            'h2': {
              color: theme('colors.sky.400'),
            },
            'h3': {
              color: theme('colors.sky.500'),
            },
            'strong': {
              color: theme('colors.indigo.400'),
            },
            'a': {
              color: theme('colors.emerald.400'),
              '&:hover': {
                color: theme('colors.emerald.300'),
              },
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}