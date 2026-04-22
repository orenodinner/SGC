import type { RendererApi } from "../shared/contracts";

declare global {
  interface Window {
    sgc?: RendererApi;
  }
}

export {};
