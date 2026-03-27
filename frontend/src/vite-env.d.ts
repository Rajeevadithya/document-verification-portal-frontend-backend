/// <reference types="vite/client" />

declare module "*.css";
declare module "*.png" {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEFAULT_UPLOADER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
