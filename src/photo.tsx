import { useEffect, useState } from 'react'
import { photoSrc } from './db'

export function Photo({ id, alt, version = 0 }: { id: string | null; alt: string; version?: number }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!id) {
      setUrl(null)
      return
    }
    photoSrc(id)
      .then((next) => {
        if (alive) setUrl(next)
      })
      .catch(() => {
        if (alive) setUrl(null)
      })
    return () => {
      alive = false
    }
  }, [id, version])

  if (!id) {
    return (
      <div className="grid h-full w-full place-items-center px-6 text-center text-xl text-mute">No photo yet</div>
    )
  }
  if (!url) return <div className="h-full w-full bg-wash" />
  return <img src={url} alt={alt} className="h-full w-full object-cover" />
}
