const config = {
  '*.{js,ts,tsx,jsx,json,css}': ['biome check --write'],
  '*.{js,ts,tsx,jsx}': ['eslint --fix'],
  '*.{ts,tsx}': [() => 'tsc --noEmit'],
};

export default config;
