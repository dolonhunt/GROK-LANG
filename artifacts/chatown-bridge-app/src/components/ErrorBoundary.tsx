import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="m-4 rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-red-100"
          >
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 text-sm opacity-80">{this.state.message}</p>
            <button
              type="button"
              className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium"
              onClick={() => this.setState({ hasError: false, message: undefined })}
            >
              Try again
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
