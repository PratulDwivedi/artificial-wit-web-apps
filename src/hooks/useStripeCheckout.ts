'use client'

import { useState } from 'react'
import { HttpHelper } from '@/lib/http'
import type { Plan } from './useRazorpay'

const BASE = process.env.NEXT_PUBLIC_AW_API_BASE_URL!

export function useStripeCheckout(userEmail: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function subscribe(plan: Plan, billingInterval: 'monthly' | 'annual') {
    setLoading(true)
    setError(null)

    try {
      const token = HttpHelper.getToken()
      if (!token) throw new Error('Not authenticated')

      const successUrl = `${window.location.origin}/billing?payment=success`
      const cancelUrl  = `${window.location.origin}/billing?payment=cancelled`

      const res = await fetch(`${BASE}/payment/checkout/stripe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Tenant-Email': userEmail,
        },
        body: JSON.stringify({
          plan_id: plan.id,
          billing_interval: billingInterval,
          success_url: successUrl,
          cancel_url:  cancelUrl,
        }),
      })

      const json = await res.json()
      if (!json.is_success) throw new Error(json.message)

      const checkoutUrl = json.data?.[0]?.checkout_url
      if (!checkoutUrl) throw new Error('No checkout URL returned')

      // Redirect to Stripe hosted checkout
      window.location.href = checkoutUrl
      // Promise never resolves — page navigates away
      return new Promise<{ success: boolean }>(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stripe checkout failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  return { subscribe, loading, error, clearError: () => setError(null) }
}
