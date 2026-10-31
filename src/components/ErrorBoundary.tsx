import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Se uma tela quebrar, mostra o erro e um jeito de sair, em vez de deixar a tela preta. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro na tela:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 pb-28 safe-top">
        <div className="card p-5">
          <div className="font-semibold">Esta tela deu erro.</div>
          <p className="mt-1 text-sm text-muted">Seus dados estão salvos. Volte ao início e tente de novo.</p>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-card2 p-2 text-xs text-dim">{this.state.error.message}</pre>
          <a href="#/" className="btn-primary mt-4 block w-full text-center" onClick={() => this.setState({ error: null })}>
            Voltar ao início
          </a>
        </div>
      </div>
    )
  }
}
