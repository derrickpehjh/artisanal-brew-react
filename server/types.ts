// Shared types for Vercel serverless API functions

export interface GeminiTextRequest {
  prompt: string
}

export interface GeminiImageData {
  mimeType: string
  data: string // base64
}

export interface GeminiImageRequest {
  prompt: string
  images: GeminiImageData[]
}

export interface GeminiResponse {
  text: string | null
}

export interface ApiErrorResponse {
  error: string
}
