import nextConfig from 'eslint-config-next/core-web-vitals';

export default [
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
  { ignores: ['.next/**', 'node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'data/**'] },
];
