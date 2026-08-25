// Converte JSON Schema (dialeto usado pelos schemas em ./schemas.ts) para o
// formato de Schema aceito pelo responseSchema da API Gemini (@google/genai).
// Principais diferenças: `type` usa o enum Type (strings maiúsculas) e não há
// `additionalProperties` — é omitido automaticamente por não ser copiado.
import { Type } from "@google/genai";

type JSONSchema = Record<string, unknown>;

const TYPE_MAP: Record<string, Type> = {
  object: Type.OBJECT,
  array: Type.ARRAY,
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
};

export function toGeminiSchema(schema: JSONSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const type = schema.type as string | undefined;
  if (type && TYPE_MAP[type]) out.type = TYPE_MAP[type];
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties as Record<string, JSONSchema>)) {
      props[k] = toGeminiSchema(v);
    }
    out.properties = props;
  }
  if (schema.items) out.items = toGeminiSchema(schema.items as JSONSchema);
  if (schema.required) out.required = schema.required;
  return out;
}
