import Stripe from 'stripe';
import { stripeConfig, validateStripeConfig } from './config';

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  validateStripeConfig();

  stripeInstance = new Stripe(stripeConfig.secretKey, {
    apiVersion: stripeConfig.apiVersion,
    typescript: true,
    maxNetworkRetries: stripeConfig.maxRetries,
    timeout: 30000,
    appInfo: {
      name: 'Edgaze',
      version: '1.0.0',
      url: stripeConfig.appUrl,
    },
  });

  return stripeInstance;
}

// Lazy initialization - only create when accessed
export const stripe = new Proxy({} as Stripe, {
  get(target, prop) {
    const client = getStripeClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

export async function retryStripeOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = stripeConfig.maxRetries
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      if (error.type === 'StripeInvalidRequestError') {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = stripeConfig.retryDelay * Math.pow(2, attempt);
        console.log(`[STRIPE] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Stripe operation failed after retries');
}

export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
  return `${prefix}_${parts.join('_')}_${Date.now()}`;
}
