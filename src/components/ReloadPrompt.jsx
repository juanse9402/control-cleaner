import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setNeedRefresh(false)
  }

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm bg-white border border-gray-200 shadow-xl rounded-2xl p-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-brand-50 p-2 rounded-full">
            <RefreshCw className="w-5 h-5 text-brand-600 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Actualización Disponible</h3>
            <p className="text-xs text-gray-500 mt-0.5">Hay una nueva versión de la app.</p>
          </div>
        </div>
        <button onClick={close} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="w-full mt-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
      >
        Actualizar Ahora
      </button>
    </div>
  )
}
