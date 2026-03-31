import { createHash } from "node:crypto";

import type { PayloadReference, SerializableValue } from "./types";

function byteLengthOf(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

export function createInlinePayloadReference(value: SerializableValue): PayloadReference {
  const serialized = JSON.stringify(value);
  return {
    storageKind: "inline",
    contentType: "application/json",
    byteLength: byteLengthOf(serialized),
    sha256: createHash("sha256").update(serialized).digest("hex"),
    value,
  };
}

export function readPayloadReferenceValue(
  reference: PayloadReference | SerializableValue | null | undefined,
): SerializableValue | undefined {
  if (reference === null || reference === undefined) return undefined;

  if (typeof reference === "object" && !Array.isArray(reference) && "storageKind" in reference) {
    return (reference as PayloadReference).value;
  }

  return reference as SerializableValue;
}
