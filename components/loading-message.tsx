"use client"

interface LoadingMessageProps {
  message?: string
}

export default function LoadingMessage({ message = "Loading media..." }: LoadingMessageProps) {
  return (
    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white py-4 px-8 rounded-lg z-[2000] flex items-center justify-center gap-3 shadow-lg backdrop-blur-sm">
      <span className="text-base font-medium">{message}</span>
      <div className="inline-block w-5 h-5 border-2 border-white/30 rounded-full border-t-white animate-spin"></div>
    </div>
  )
}
