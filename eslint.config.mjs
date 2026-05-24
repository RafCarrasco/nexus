import nextConfig from 'eslint-config-next/core-web-vitals';

export default [
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
  { ignores: ['.next/**', 'node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'data/**'] },
  {
    files: ['src/ui/components/chat-widget.tsx'],
    rules: {
      // localStorage hydration in useEffect requires calling setState inside effect body.
      // This is the standard pattern for client-only state initialization.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
