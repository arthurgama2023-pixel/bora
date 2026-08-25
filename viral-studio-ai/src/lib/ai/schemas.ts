// JSON Schemas para saída estruturada do Claude.
// Regras da API: todo objeto precisa de additionalProperties:false e required completo.

const momentSchema = {
  type: "object",
  additionalProperties: false,
  required: ["video", "start", "end", "type", "intensity", "reason"],
  properties: {
    video: { type: "number", description: "Índice do vídeo de origem (0-based)" },
    start: { type: "number" },
    end: { type: "number" },
    type: {
      type: "string",
      enum: [
        "gancho",
        "pico_emocional",
        "engracado",
        "insight",
        "autoridade",
        "curiosidade",
        "tensao",
        "cta",
        "parte_fraca",
        "silencio",
        "mudanca_assunto",
      ],
    },
    intensity: { type: "number" },
    reason: { type: "string" },
  },
};

export const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["niche", "audience", "goal", "tone", "summary", "hookQuality", "hookComment", "moments"],
  properties: {
    niche: { type: "string" },
    audience: { type: "string" },
    goal: { type: "string" },
    tone: { type: "string" },
    summary: { type: "string" },
    hookQuality: { type: "number" },
    hookComment: { type: "string" },
    moments: { type: "array", items: momentSchema },
  },
};

export const viralSchema = {
  type: "object",
  additionalProperties: false,
  required: ["niche", "idealDuration", "cutsPerMinute", "hookStyle", "captionStyle", "ctaStyle", "pacing", "insights"],
  properties: {
    niche: { type: "string" },
    idealDuration: { type: "number" },
    cutsPerMinute: { type: "number" },
    hookStyle: { type: "string" },
    captionStyle: { type: "string" },
    ctaStyle: { type: "string" },
    pacing: { type: "string" },
    insights: { type: "array", items: { type: "string" } },
  },
};

export const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["decisions", "targetDuration", "notes"],
  properties: {
    targetDuration: { type: "number" },
    notes: { type: "string" },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "video", "start", "end", "factor", "style", "reason"],
        properties: {
          type: {
            type: "string",
            enum: ["remove_silence", "remove_segment", "hook_teaser", "zoom", "speed", "caption_style", "filter"],
          },
          video: { type: "number", description: "Índice do vídeo de origem (0-based)" },
          start: { type: "number" },
          end: { type: "number" },
          factor: { type: "number" },
          style: {
            type: "string",
            description: "Somente para type=filter: cinematic|vivid|warm|cold|bw|none. Vazio nos demais.",
          },
          reason: { type: "string" },
        },
      },
    },
  },
};

export const creativeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "titles",
    "headline",
    "descriptionYouTube",
    "captionInstagram",
    "captionTikTok",
    "hashtags",
    "cta",
    "bestTimes",
  ],
  properties: {
    titles: { type: "array", items: { type: "string" } },
    headline: { type: "string" },
    descriptionYouTube: { type: "string" },
    captionInstagram: { type: "string" },
    captionTikTok: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    cta: { type: "string" },
    bestTimes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "time", "why"],
        properties: {
          platform: { type: "string" },
          time: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
};

export const scoresSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "overall", "verdict"],
  properties: {
    overall: { type: "number" },
    verdict: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "explanation"],
        properties: {
          name: { type: "string" },
          score: { type: "number" },
          explanation: { type: "string" },
        },
      },
    },
  },
};
