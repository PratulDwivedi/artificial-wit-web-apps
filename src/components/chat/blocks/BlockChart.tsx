'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
  DoughnutController, PieController, BarController, LineController,
  type ChartConfiguration,
} from 'chart.js'
import type { ChartBlock } from './types'

Chart.register(
  ArcElement, BarElement, LineElement, PointElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Filler,
  DoughnutController, PieController, BarController, LineController,
)

const PALETTE = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#F97316','#EC4899']

function resolveColors(block: ChartBlock): string[] {
  // One dataset with multiple labels — each slice gets its own palette color.
  // Only use per-dataset colors when there's a 1:1 match (one dataset per label).
  const perDataset = block.datasets.length === block.labels.length
  return block.labels.map((_, i) =>
    perDataset ? (block.datasets[i]?.color ?? PALETTE[i % PALETTE.length]) : PALETTE[i % PALETTE.length]
  )
}

function buildConfig(block: ChartBlock): ChartConfiguration {
  const isPolar  = block.chartType === 'pie' || block.chartType === 'doughnut'
  const isLine   = block.chartType === 'line'
  const colors   = isPolar ? resolveColors(block) : undefined

  const datasets = block.datasets.map((ds, i) => ({
    label:           ds.label,
    data:            ds.data,
    backgroundColor: isPolar
      ? colors
      : isLine
        ? (ds.color ?? PALETTE[i % PALETTE.length]) + '33'
        : (ds.color ?? PALETTE[i % PALETTE.length]),
    borderColor:     isPolar ? colors?.map(c => c + 'cc') : (ds.color ?? PALETTE[i % PALETTE.length]),
    borderWidth:     isPolar ? 1 : isLine ? 2 : 0,
    borderRadius:    (!isPolar && !isLine) ? 4 : undefined,
    fill:            isLine ? true : undefined,
    tension:         isLine ? 0.35 : undefined,
    hoverOffset:     isPolar ? 6 : undefined,
    pointRadius:     isLine ? 3 : undefined,
    pointHoverRadius: isLine ? 5 : undefined,
  }))

  const type = block.chartType === 'column' ? 'bar' : block.chartType as ChartConfiguration['type']

  return {
    type,
    data: {
      labels:   block.labels,
      datasets,
    },
    options: {
      responsive:          true,
      maintainAspectRatio: true,
      animation:           { duration: 350 },
      plugins: {
        legend: {
          display:  true,
          position: isPolar ? 'right' : 'bottom',
          labels: {
            boxWidth:  10,
            boxHeight: 10,
            padding:   14,
            font:      { size: 11 },
            color:     'var(--c-t3)',
          },
        },
        tooltip: {
          backgroundColor: 'var(--c-panel)',
          titleColor:      'var(--c-t1)',
          bodyColor:       'var(--c-t2)',
          borderColor:     'var(--c-border)',
          borderWidth:     1,
          padding:         10,
          cornerRadius:    8,
          titleFont:       { size: 12, weight: 'bold' },
          bodyFont:        { size: 11 },
        },
      },
      scales: isPolar ? {} : {
        x: {
          grid:  { color: 'var(--c-border)', lineWidth: 1 },
          ticks: { color: 'var(--c-t4)', font: { size: 10 } },
        },
        y: {
          grid:  { color: 'var(--c-border)', lineWidth: 1 },
          ticks: { color: 'var(--c-t4)', font: { size: 10 } },
          beginAtZero: true,
        },
      },
    },
  }
}

export default function BlockChart({ block }: { block: ChartBlock }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, buildConfig(block))
    return () => { chartRef.current?.destroy(); chartRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id])

  const isPolar = block.chartType === 'pie' || block.chartType === 'doughnut'

  return (
    <div className="rounded-xl border mt-2 overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>

      <div className="px-4 py-2.5 border-b text-[13px] font-semibold"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', color: 'var(--c-t1)' }}>
        {block.title}
      </div>

      <div className="px-4 py-4 flex justify-center" style={{ maxHeight: 320 }}>
        <canvas ref={canvasRef} style={{ maxHeight: isPolar ? 240 : 280 }} />
      </div>

      {block.stats && block.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-t"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-border)' }}>
          {block.stats.map((s, i) => (
            <div key={i} className="px-4 py-3 flex flex-col gap-0.5"
              style={{ background: 'var(--c-panel)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--c-t5)' }}>
                {s.label}
              </span>
              <span className="text-[15px] font-bold" style={{ color: s.color ?? 'var(--c-t1)' }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
