// Next resolves PostCSS plugins by name, so this has to stay the object form —
// importing and calling the plugin gives "Malformed PostCSS Configuration".
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
