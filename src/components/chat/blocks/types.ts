export interface FormField {
  name: string
  label: string
  fieldType: 'text' | 'select' | 'textarea' | 'number'
  required?: boolean
  mcpSource?: string
}

export interface FormBlock {
  type: 'form'
  id: string
  title: string
  mcpSubmitTool: string
  submitLabel?: string
  fields: FormField[]
}

export interface TableColumn { key: string; label: string; type: string }

export interface TableBlock {
  type: 'table'
  id: string
  title: string
  totalRows?: number
  columns: TableColumn[]
  rows: Record<string, string>[]
}

export interface ChartDataset { label: string; data: number[]; color: string }
export interface ChartStat { label: string; value: string; color?: string }

export interface ChartBlock {
  type: 'chart'
  id: string
  chartType: 'bar' | 'column' | 'line' | 'pie' | 'doughnut'
  title: string
  labels: string[]
  datasets: ChartDataset[]
  stats?: ChartStat[]
}

export interface MarkdownBlock {
  type: 'markdown'
  id:      string
  content: string
}

export type Block = FormBlock | TableBlock | ChartBlock | MarkdownBlock
