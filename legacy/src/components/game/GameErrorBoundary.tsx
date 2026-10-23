import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate } from '@/i18n'
import { useSettingsStore } from '@/stores/settingsStore'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Solfront render failure', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const language = useSettingsStore.getState().language

    return (
      <div className="fatal-state" role="alert">
        <span className="section-index">{translate('error.link', language)}</span>
        <h1>{translate('error.title', language)}</h1>
        <p>{this.state.error.message}</p>
        <button className="action-button action-button--primary" type="button" onClick={() => window.location.reload()}>
          <span>{translate('error.reset', language)}</span> {translate('error.reload', language)} <i />
        </button>
      </div>
    )
  }
}
