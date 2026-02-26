import React from 'react'

type EventItem = {
  id?: number
  title: string
  date?: string
  description?: string
}

type EventsModalProps = {
  isOpen: boolean
  onClose: () => void
  events: EventItem[]
}

export default function EventsModal({
  isOpen,
  onClose,
  events
}: EventsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#b48a28] px-4 py-3 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-white">
            Sự kiện
          </h2>
          <button
            onClick={onClose}
            className="text-white text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
          {events.length === 0 && (
            <p className="text-center text-gray-500 text-xs">
              Chưa có sự kiện
            </p>
          )}

          {events.map((event, index) => (
            <div
              key={event.id ?? index}
              className="border rounded-md p-2"
            >
              <p className="font-medium text-sm">
                {event.title}
              </p>

              {event.date && (
                <p className="text-xs text-gray-500">
                  {event.date}
                </p>
              )}

              {event.description && (
                <p className="text-xs text-gray-600 mt-1">
                  {event.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 flex justify-end border-t">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-md bg-gray-200 hover:bg-gray-300"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
