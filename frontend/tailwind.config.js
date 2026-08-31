/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        // Warm stone neutrals in place of clinical cool grays.
        gray: {
          50:  '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        // Brand green: warm moss/olive instead of neon SaaS emerald.
        emerald: {
          50:  '#f2f5ea',
          100: '#e3ead3',
          200: '#c8d6aa',
          300: '#a8bf7d',
          400: '#86a857',
          500: '#6b8f3f',
          600: '#557233',
          700: '#435c2a',
          800: '#384a25',
          900: '#2e3d20',
          950: '#212b16',
        },
        // Muted plum rather than vivid violet, so the "AI / future feature"
        // accent sits inside the warm palette instead of fighting it.
        purple: {
          50:  '#faf6f8',
          100: '#f3e9ef',
          200: '#e6d3de',
          300: '#d2b0c4',
          400: '#b885a4',
          500: '#9c6285',
          600: '#82506d',
          700: '#6b4159',
          800: '#57354a',
          900: '#482d3e',
          950: '#2f1c28',
        },
        // Sage-teal that harmonises with the moss brand green.
        teal: {
          50:  '#f0f7f5',
          100: '#daece7',
          200: '#b7d8d0',
          300: '#8bbdb2',
          400: '#5f9e91',
          500: '#448175',
          600: '#34675e',
          700: '#2b524c',
          800: '#26423e',
          900: '#223834',
          950: '#132320',
        },
        // Warm terracotta accent for highlights, secondary CTAs, and variety.
        clay: {
          50:  '#fdf3ee',
          100: '#fbe4d8',
          200: '#f5c4ac',
          300: '#eda07c',
          400: '#e17f51',
          500: '#c86538',
          600: '#a8502c',
          700: '#874025',
          800: '#6d341f',
          900: '#582b1b',
          950: '#341809',
        },
        brand: {
          50:  '#f2f5ea',
          100: '#e3ead3',
          200: '#c8d6aa',
          300: '#a8bf7d',
          400: '#86a857',
          500: '#6b8f3f',
          600: '#557233',
          700: '#435c2a',
          800: '#384a25',
          900: '#2e3d20',
        },
      },
    },
  },
  plugins: [],
}
