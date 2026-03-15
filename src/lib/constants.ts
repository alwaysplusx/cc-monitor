// Plan token limits and color constants

export const CHART_COLORS = {
  input: '#3b82f6', // blue
  output: '#8b5cf6', // purple
  cacheRead: '#06b6d4', // cyan
  green: '#10b981',
}

export type TimeView = 'minute' | 'hour' | 'day' | 'month'

// Model pricing lookup from settings config
import type { ModelPricingConfig } from '../types/ipc'

export interface ModelPricing {
  input: number
  output: number
  cacheRead: number
}

const DEFAULT_PRICING: ModelPricing = { input: 3, output: 15, cacheRead: 0.3 }

export function getModelPricing(model: string, pricingConfig: ModelPricingConfig[]): ModelPricing {
  const lower = model.toLowerCase()
  for (const tier of pricingConfig) {
    if (lower.includes(tier.match.toLowerCase())) {
      return { input: tier.input, output: tier.output, cacheRead: tier.cacheRead }
    }
  }
  return DEFAULT_PRICING
}
