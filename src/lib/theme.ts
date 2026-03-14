// ECharts theme definitions for dark and light modes
export const echartsLightTheme = {
  color: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  backgroundColor: 'transparent',
  textStyle: { color: '#1a202c' },
  title: { textStyle: { color: '#1a202c' } },
  legend: { textStyle: { color: '#64748b' } },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    textStyle: { color: '#1a202c' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#e2e8f0' } },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: '#f1f5f9' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#e2e8f0' } },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: '#f1f5f9' } },
  },
}

export const echartsDarkTheme = {
  color: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
  backgroundColor: 'transparent',
  textStyle: { color: '#e2e8f0' },
  title: { textStyle: { color: '#e2e8f0' } },
  legend: { textStyle: { color: '#8892a8' } },
  tooltip: {
    backgroundColor: '#111827',
    borderColor: '#1e293b',
    textStyle: { color: '#e2e8f0' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#1e293b' } },
    axisLabel: { color: '#8892a8' },
    splitLine: { lineStyle: { color: '#151d2e' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#1e293b' } },
    axisLabel: { color: '#8892a8' },
    splitLine: { lineStyle: { color: '#151d2e' } },
  },
}
