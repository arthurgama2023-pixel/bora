import { fal } from "@fal-ai/client";

let configured = false;

/** Cliente fal.ai configurado com a credencial do ambiente (uma única vez). */
export function getFal(): typeof fal {
  if (!configured) {
    fal.config({ credentials: process.env.FAL_KEY });
    configured = true;
  }
  return fal;
}
