import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline  = () => setOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -56, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed top-16 left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-medium py-2 px-4 shadow-lg"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>{t('errors.offline')} — {t('errors.offlineDesc')}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
