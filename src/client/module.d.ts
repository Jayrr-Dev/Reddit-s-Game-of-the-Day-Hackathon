declare module '*.svg' {
  const url: string;
  export default url;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}
declare module '*.ogg' {
  const url: string;
  export default url;
}

// --- VITE GLOB IMPORTS ---
// The eager form of Vite's import.meta.glob (the assets catalog uses it);
// vite/client types are not loaded, so only this call shape is declared.
interface ImportMeta {
  glob<T>(
    patterns: string | readonly string[],
    options: { eager: true; query?: string; import?: string },
  ): Record<string, T>;
}
