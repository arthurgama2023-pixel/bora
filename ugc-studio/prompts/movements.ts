import type { Movement } from "@/types";

/** Biblioteca de movimentos reutilizáveis para animar o avatar. */
export const MOVEMENTS: Movement[] = [
  {
    id: "tiktok-dance",
    label: "TikTok Dance",
    emoji: "💃",
    motionPrompt:
      "The model does a fun, trendy TikTok dance with rhythmic arm and hip movements, smiling naturally at the camera",
  },
  {
    id: "fashion-walk",
    label: "Fashion Walk",
    emoji: "🚶‍♀️",
    motionPrompt:
      "The model walks confidently toward the camera like on a fashion runway, natural stride, subtle fabric movement",
  },
  {
    id: "spin",
    label: "Spin",
    emoji: "🌀",
    motionPrompt:
      "The model does a smooth playful spin in place, the outfit flowing naturally with the motion",
  },
  {
    id: "360-turn",
    label: "360 Turn",
    emoji: "🔄",
    motionPrompt:
      "The model slowly turns a full 360 degrees in place, showing the outfit from every angle",
  },
  {
    id: "catwalk",
    label: "Catwalk",
    emoji: "🐈",
    motionPrompt:
      "The model does an elegant catwalk with crossed steps and confident posture, hands relaxed",
  },
  {
    id: "mirror-pose",
    label: "Mirror Pose",
    emoji: "🪞",
    motionPrompt:
      "The model poses as if checking herself in a mirror, adjusting the outfit gently and tilting her head",
  },
  {
    id: "outfit-transition",
    label: "Outfit Transition",
    emoji: "✨",
    motionPrompt:
      "The model does a stylish fashion transition move: covers the camera briefly with her hand then reveals the outfit with a confident pose",
  },
  {
    id: "happy-dance",
    label: "Happy Dance",
    emoji: "🥳",
    motionPrompt:
      "The model does a light happy dance, bouncing gently and laughing naturally, joyful energy",
  },
  {
    id: "street-walk",
    label: "Street Walk",
    emoji: "🏙️",
    motionPrompt:
      "The model walks casually like on a city street, relaxed urban vibe, looking around naturally",
  },
  {
    id: "pose-smile",
    label: "Pose and Smile",
    emoji: "😊",
    motionPrompt:
      "The model shifts between two natural poses and smiles warmly at the camera, subtle head movement",
  },
  {
    id: "product-showcase",
    label: "Product Showcase",
    emoji: "🛍️",
    motionPrompt:
      "The model highlights the product with her hands, gesturing toward it and presenting it proudly to the camera",
  },
  {
    id: "close-look",
    label: "Close Look",
    emoji: "🔍",
    motionPrompt:
      "The model leans slightly closer to the camera showing the product details, gentle slow movement",
  },
  {
    id: "slow-turn",
    label: "Slow Turn",
    emoji: "🐢",
    motionPrompt:
      "The model turns slowly to the side and back, calm and elegant motion, soft natural sway",
  },
  {
    id: "fashion-model",
    label: "Fashion Model",
    emoji: "📸",
    motionPrompt:
      "The model poses like a professional fashion model in a photoshoot, changing poses smoothly every few seconds",
  },
  {
    id: "tiktok-trend",
    label: "TikTok Trend",
    emoji: "🔥",
    motionPrompt:
      "The model performs a viral TikTok trend move with confident energy, pointing gestures and a final pose",
  },
];

export function getMovement(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id);
}
