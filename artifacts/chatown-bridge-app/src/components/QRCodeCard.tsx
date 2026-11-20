import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface Props {
  url: string
  code: string
}

export function QRCodeCard({ url, code }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: '#0f766e', light: '#ffffff' },
    }).then((d) => {
      if (!cancelled) setDataUrl(d)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-4">
      {dataUrl ? (
        <img src={dataUrl} alt={`QR code for room ${code}`} className="h-40 w-40 rounded-lg" />
      ) : (
        <div className="h-40 w-40 animate-pulse rounded-lg bg-slate-800" />
      )}
      <p className="font-mono text-2xl font-bold tracking-[0.3em] text-teal-300">{code}</p>
      <p className="break-all text-center text-[10px] text-slate-400">{url}</p>
    </div>
  )
}
