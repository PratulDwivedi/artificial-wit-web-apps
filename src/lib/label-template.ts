// ── Element types ─────────────────────────────────────────────────────────────

export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface BaseElement {
  id:     string
  x_mm:   number
  y_mm:   number
  w_mm:   number
  h_mm:   number
  locked: boolean
}

export interface QrElement extends BaseElement {
  type:             'qr'
  value_template:   string
  fg:               string
  bg:               string
  error_correction: 'L' | 'M' | 'Q' | 'H'
  transparent_bg:   boolean
}

export interface BarcodeElement extends BaseElement {
  type:           'barcode'
  value_template: string
  fg:             string
  bg:             string
  format:         string
  show_value:     boolean
}

export interface TextElement extends BaseElement {
  type:        'text'
  content:     string
  font_size:   number
  font_weight: 'normal' | 'bold'
  color:       string
  align:       'left' | 'center' | 'right'
  font_family: string
}

export interface RectElement extends BaseElement {
  type:         'rect'
  fill:         string
  stroke:       string
  stroke_width: number
  radius:       number
}

export interface LineElement extends BaseElement {
  type:      'line'
  color:     string
  thickness: number
  direction: 'h' | 'v'
}

export interface ImageElement extends BaseElement {
  type: 'image'
  url:  string
  fit:  'contain' | 'cover' | 'fill'
}

export type CanvasElement =
  | QrElement | BarcodeElement | TextElement
  | RectElement | LineElement | ImageElement

// ── Canvas / template ─────────────────────────────────────────────────────────

export interface CanvasConfig {
  width_mm:         number
  height_mm:        number
  background_color: string
  grid_mm:          number
  show_grid:        boolean
}

export interface LabelTemplate {
  id?:      number
  name:     string
  page_id:  number | null
  canvas:   CanvasConfig
  elements: CanvasElement[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const DEFAULT_CANVAS: CanvasConfig = {
  width_mm:         80,
  height_mm:        40,
  background_color: '#ffffff',
  grid_mm:          5,
  show_grid:        true,
}

export const DEFAULT_TEMPLATE: LabelTemplate = {
  name:     '',
  page_id:  null,
  canvas:   { ...DEFAULT_CANVAS },
  elements: [],
}

export function makeQr(canvas: CanvasConfig): QrElement {
  return {
    id: newId(), type: 'qr', locked: false,
    x_mm: Math.max(2, canvas.width_mm  * 0.05),
    y_mm: Math.max(2, canvas.height_mm * 0.05),
    w_mm: Math.min(25, canvas.height_mm * 0.8),
    h_mm: Math.min(25, canvas.height_mm * 0.8),
    value_template: '', fg: '#000000', bg: '#ffffff',
    error_correction: 'M', transparent_bg: false,
  }
}

export function makeBarcode(canvas: CanvasConfig): BarcodeElement {
  return {
    id: newId(), type: 'barcode', locked: false,
    x_mm: Math.max(2, canvas.width_mm  * 0.05),
    y_mm: Math.max(2, canvas.height_mm * 0.25),
    w_mm: canvas.width_mm * 0.7,
    h_mm: canvas.height_mm * 0.5,
    value_template: '', fg: '#000000', bg: '#ffffff',
    format: 'CODE128', show_value: true,
  }
}

export function makeText(canvas: CanvasConfig): TextElement {
  return {
    id: newId(), type: 'text', locked: false,
    x_mm: Math.max(2, canvas.width_mm  * 0.05),
    y_mm: Math.max(2, canvas.height_mm * 0.05),
    w_mm: canvas.width_mm * 0.5, h_mm: 8,
    content: 'Text', font_size: 12, font_weight: 'normal',
    color: '#000000', align: 'left', font_family: 'system-ui',
  }
}

export function makeRect(canvas: CanvasConfig): RectElement {
  return {
    id: newId(), type: 'rect', locked: false,
    x_mm: canvas.width_mm * 0.1, y_mm: canvas.height_mm * 0.1,
    w_mm: canvas.width_mm * 0.4, h_mm: canvas.height_mm * 0.4,
    fill: '#f3f4f6', stroke: '#9ca3af', stroke_width: 1, radius: 0,
  }
}

export function makeLine(canvas: CanvasConfig): LineElement {
  return {
    id: newId(), type: 'line', locked: false,
    x_mm: canvas.width_mm * 0.05, y_mm: canvas.height_mm * 0.5,
    w_mm: canvas.width_mm * 0.9, h_mm: 2,
    color: '#374151', thickness: 1, direction: 'h',
  }
}

export function makeImage(canvas: CanvasConfig): ImageElement {
  return {
    id: newId(), type: 'image', locked: false,
    x_mm: canvas.width_mm * 0.05, y_mm: canvas.height_mm * 0.05,
    w_mm: 20, h_mm: 20,
    url: '', fit: 'contain',
  }
}
