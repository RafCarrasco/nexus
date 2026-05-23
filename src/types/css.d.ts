// Type shim for CSS imports — required when shadcn/ui or other libraries
// add CSS Module imports (e.g. `import styles from './x.module.css'`).
// A bare side-effect import like `import './globals.css'` resolves to
// void without this declaration, but CSS Module imports do not.
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
