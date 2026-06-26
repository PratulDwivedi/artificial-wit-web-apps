'use client'

import { useState } from 'react'
import { HttpHelper } from '@/lib/http'

const BASE = process.env.NEXT_PUBLIC_AW_API_BASE_URL!

export interface Plan {
  id: number
  name: string
  description: string
  price_monthly: number
  price_annual: number
  currency: string
  features: Record<string, unknown>
  sort_order: number
}

export function useRazorpay(userEmail: string, userName: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function subscribe(plan: Plan, billingInterval: 'monthly' | 'annual') {
    setLoading(true)
    setError(null)

    try {
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
            } catch (err) {
              reject(err)
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (window as any).Razorpay(options).open()
      })

      return { success: true }
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
