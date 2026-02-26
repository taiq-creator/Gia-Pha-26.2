import React from 'react'

type EventItem = {
  title: string
  date?: string
  description?: string
}

type EventsModalProps = {
  isOpen: boolean
  onClose: () => void
  events: EventItem[]
}

const EventsModal = (props: EventsModalProps) => {
  const { isOpen, onClose, events } = props

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-sm rounded-lg shadow-lg p-4 relative">
        
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 text-lg"
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="text-base font-semibold mb-3 text-center">
          Sự kiện – Ghi chú
        </h2>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto text-sm">
          {events.length === 0 && (
            <p className="text-center text-gray-500">
              Chưa có sự kiện
            </p>
          )}

          {events.map((event, index) => (
            <div
              key={index}
              className="border rounded-md p-2"
            >
              <p className="font-medium">
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

        <div className="mt-4 flex justify-center">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md bg-gray-200 hover:bg-gray-300"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export default EventsModal
