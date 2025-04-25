"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import VideoPlayer from "@/components/video-player"

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const searchParams = useSearchParams()
  const headless = searchParams?.get("headless") === "true"

  useEffect(() => {
    setIsClient(true)
  }, [])

  return <main className="min-h-screen">{isClient && <VideoPlayer initialHeadless={headless} />}</main>
}
