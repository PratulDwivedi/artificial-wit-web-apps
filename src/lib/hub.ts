export interface HubNotification {
  type: 'notification'
  event: string
  channel?: string
  user_id?: string
  data: Record<string, unknown>
}

export interface HubConnectedMessage {
  type: 'connected'
  connection_id: string
  tenant_id: string
  user_id: string
}

export type EventHandler = (data: Record<string, unknown>) => void
