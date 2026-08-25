/** Status de uma geração: imagem criada aguardando aprovação, aprovada, ou com vídeo pronto. */
export type GenerationStatus = "pending" | "approved" | "video_ready";

/** Registro de uma geração de imagem (e depois vídeo) mantido no servidor. */
export interface Generation {
  id: string;
  /** URL da imagem gerada (remota ou data URL no modo demo). */
  imageUrl: string;
  status: GenerationStatus;
  /** URL local do vídeo final, presente após a animação. */
  videoUrl?: string;
  createdAt: number;
}

/** Movimento reutilizável da biblioteca, usado como base do prompt de vídeo. */
export interface Movement {
  id: string;
  /** Nome exibido na interface. */
  label: string;
  emoji: string;
  /** Descrição de movimento em inglês enviada ao modelo de vídeo. */
  motionPrompt: string;
}

export interface GenerateImageRequest {
  avatarDataUrl: string;
  productDataUrl: string;
  /** Direção criativa do usuário — guia a fusão de avatar + produto na imagem. */
  prompt: string;
}

export interface GenerateImageResponse {
  id: string;
  imageUrl: string;
  mock: boolean;
}

export interface ApproveRequest {
  id: string;
}

export interface GenerateVideoRequest {
  id: string;
  movementId: string;
  /** Prompt livre do usuário — usado somente na geração do vídeo. */
  userPrompt: string;
}

export interface GenerateVideoResponse {
  id: string;
  videoUrl: string;
  mock: boolean;
}

export interface ApiError {
  error: string;
}
