'use client'

import { useState } from 'react'
import { HttpHelper } from '@/lib/http'
import type { Plan } from './useRazorpay'

const BASE = process.env.NEXT_PUBLIC_AW_API_BASE_URL!

export type PaymentProvider = 'razorpay' | 'stripe'

/**
 * Unified payment hook. Provider is resolved at subscribe-time so it stays
 * reactive to subscription data loaded by BillingPage without violating hook rules.
 */
export function usePaymentGateway(userEmail: string, userName: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function subscribe(
    plan: Plan,
    billingInterval: 'monthly' | 'annual',
    provider: PaymentProvider,
  ): Promise<{ success: boolean; error?: string }> {
    setLoading(true)
    setError(null)

    try {
      if (provider === 'stripe') {
        return await _stripeCheckout(plan, billingInterval, userEmail)
      }
      return await _razorpayCheckout(plan, billingInterval, userEmail, userName)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  return { subscribe, loading, error, clearError: () => setError(null) }
}

// ── Razorpay ─────────────────────────────────────────────────────────────────

async function _razorpayCheckout(
  plan: Plan,
  billingInterval: 'monthly' | 'annual',
  userEmail: string,
  userName: string,
): Promise<{ success: boolean; error?: string }> {
  const token = HttpHelper.getToken()
  if (!token) throw new Error('Not authenticated')

  const orderRes = await fetch(`${BASE}/payment/order/razorpay`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Email': userEmail,
      'X-Tenant-Name': userName,
    },
    body: JSON.stringify({
      plan_id: plan.id,
      billing_interval: billingInterval,
      currency: plan.currency || 'INR',
    }),
  })
  const orderJson = await orderRes.json()
  if (!orderJson.is_success) throw new Error(orderJson.message)
  const order = orderJson.data[0]

  await new Promise<void>((resolve, reject) => {
    const primary =
      getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#dc2626'

    const options = {
      key:      order.key_id,
      amount:   order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name:        'Artificial Wit',
      description: `${plan.name} – ${billingInterval}`,
      prefill: { email: userEmail, name: userName },
      theme:   { color: primary },
      handler: async (response: Record<string, string>) => {
        try {
          const verifyRes = await fetch(`${BASE}/payment/verify/razorpay`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${HttpHelper.getToken() ?? ''}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              plan_id: plan.id,
              billing_interval: billingInterval,
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          })
          const verifyJson = await verifyRes.json()
          if (!verifyJson.is_success) throw new Error(verifyJson.message)
          resolve()
        } catch (err) { reject(err) }
      },
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (window as any).Razorpay(options).open()
  })

  return { success: true }
}

// ── Stripe ────────────────────────────────────────────────────────────────────

async function _stripeCheckout(
  plan: Plan,
  billingInterval: 'monthly' | 'annual',
  userEmail: string,
): Promise<{ success: boolean; error?: string }> {
  const token = HttpHelper.getToken()
  if (!token) throw new Error('Not authenticated')

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
      success_url: `${window.location.origin}/billing?payment=success`,
      cancel_url:  `${window.location.origin}/billing?payment=cancelled`,
    }),
  })

  const json = await res.json()
  if (!json.is_success) throw new Error(json.message)

  const checkoutUrl = json.data?.[0]?.checkout_url
  if (!checkoutUrl) throw new Error('No checkout URL returned')

  // Redirect to Stripe hosted checkout — page navigates away
  window.location.href = checkoutUrl
  return new Promise(() => {}) // never resolves; navigation takes over
}
