// MigraineChart.jsx — Panel Médico Limpio
// Chart.js registration at MODULE LEVEL — prevents initialization errors
import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend);

export default function MigraineChart({ dailyData, refAreasRegla, refAreasPredicted }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!dailyData || dailyData.length === 0 || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = dailyData.map((d) => d.name);

    // Only show dots where value > 0 — map 0 → null for point visibility
    const naproxenoData = dailyData.map((d) => (d.Naproxeno > 0 ? 1 : null)); // carril 1
    const imigranData   = dailyData.map((d) => (d.Imigran   > 0 ? 2 : null)); // carril 2

    // Build Sets for highlighted days
    const reglaSet = new Set();
    (refAreasRegla || []).forEach(({ start, end }) => {
      for (let d = parseInt(start); d <= parseInt(end); d++) reglaSet.add(String(d));
    });
    const predictedSet = new Set();
    (refAreasPredicted || []).forEach(({ start, end }) => {
      for (let d = parseInt(start); d <= parseInt(end); d++) predictedSet.add(String(d));
    });

    // Background bands plugin
    const backgroundPlugin = {
      id: 'backgroundBands',
      beforeDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        const bw = scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0);

        labels.forEach((label, idx) => {
          const xCenter = scales.x.getPixelForValue(idx);
          const xStart  = xCenter - bw / 2;
          const bandH   = chartArea.bottom - chartArea.top;

          if (reglaSet.has(label)) {
            ctx.save();
            ctx.fillStyle = '#FFF0F5';
            ctx.fillRect(xStart, chartArea.top, bw, bandH);
            ctx.restore();
          } else if (predictedSet.has(label)) {
            ctx.save();
            ctx.fillStyle = 'rgba(229,231,235,0.45)';
            ctx.fillRect(xStart, chartArea.top, bw, bandH);
            ctx.restore();
          }
        });
      },
    };

    // "Ciclo" label on first regla band top
    const cicloLabelPlugin = {
      id: 'cicloLabel',
      afterDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;
        let drawnFirst = false;
        labels.forEach((label, idx) => {
          if (reglaSet.has(label) && !drawnFirst) {
            drawnFirst = true;
            const x = scales.x.getPixelForValue(idx);
            ctx.save();
            ctx.fillStyle = '#f472b6';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🌸 Ciclo', x, chartArea.top + 10);
            ctx.restore();
          }
        });
      },
    };

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      plugins: [backgroundPlugin, cicloLabelPlugin],
      data: {
        labels,
        datasets: [
          {
            label: 'Naproxeno (Leve)',
            data: naproxenoData,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#f97316',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: naproxenoData.map(v => v !== null ? 7 : 0),
            pointHoverRadius: naproxenoData.map(v => v !== null ? 9 : 0),
            tension: 0,          // straight horizontal connections
            spanGaps: false,     // don't draw line between null values
          },
          {
            label: 'Imigran (Fuerte)',
            data: imigranData,
            borderColor: '#e11d48',
            backgroundColor: 'rgba(225,29,72,0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#e11d48',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: imigranData.map(v => v !== null ? 7 : 0),
            pointHoverRadius: imigranData.map(v => v !== null ? 9 : 0),
            tension: 0,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              font: { size: 11, family: 'Inter, sans-serif' },
              color: '#6b7280',
              padding: 14,
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#111827',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            callbacks: {
              label: (item) => {
                const label = item.dataset.label;
                const raw   = item.raw;
                if (raw === null || raw === undefined) return null;
                return ` ${label}`;
              },
              afterLabel: (item) => {
                const day = item.label;
                if (reglaSet.has(day)) return ' 🌸 Día de regla';
                if (predictedSet.has(day)) return ' ⚪ Predicción';
                return null;
              },
              title: (items) => `Día ${items[0]?.label}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#d1d5db',
              font: { size: 9 },
              maxTicksLimit: 16,
              maxRotation: 0,
            },
          },
          y: {
            min: 0,
            max: 3,
            grid: {
              color: 'rgba(243,244,246,0.5)',
              lineWidth: 1,
            },
            border: { display: false },
            ticks: {
              stepSize: 1,
              color: '#d1d5db',
              font: { size: 10 },
              callback: (val) => {
                if (val === 1) return '💊 Naproxeno';
                if (val === 2) return '💉 Imigran';
                return '';
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [dailyData, refAreasRegla, refAreasPredicted]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
