import { useProgress } from '@react-three/drei'
import { useI18n } from '@/i18n'

export function LoadingOverlay() {
  const { t } = useI18n()
  const { active, progress, item, errors } = useProgress()
  if (!active && progress >= 100 && errors.length === 0) return null

  return (
    <div className="loading-screen" aria-live="polite">
      <div className="loading-screen__mark"><i /><span>SF</span></div>
      <span className="section-index">{t('loading.systems')}</span>
      <h1>{errors.length > 0 ? t('loading.degraded') : t('loading.calibrating')}</h1>
      <div className="loading-screen__track"><i style={{ width: `${Math.max(4, progress)}%` }} /></div>
      <div className="loading-screen__meta"><span>{Math.round(progress).toString().padStart(3, '0')}%</span><span>{item ? item.split('/').pop() : t('loading.initializing')}</span></div>
    </div>
  )
}
