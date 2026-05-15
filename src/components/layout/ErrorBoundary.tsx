import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props  { children: ReactNode }
interface State  { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-6 text-center">
        <div className="animate-bounce-in">
          <div className="w-20 h-20 rounded-3xl bg-red-100 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-500 max-w-xs mb-8">
          An unexpected error occurred. Please refresh the page and try again.
        </p>

        {this.state.message && (
          <p className="text-xs font-mono text-gray-400 bg-gray-100 rounded-lg px-3 py-2 mb-6 max-w-xs break-all">
            {this.state.message}
          </p>
        )}

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-5 py-3 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh page
        </button>
      </div>
    )
  }
}
