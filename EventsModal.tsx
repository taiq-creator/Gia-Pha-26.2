interface EventsModalProps {
  isOpen: boolean
  onClose: () => void
  events: {
    title: string
    date?: string
    description?: string
  }[]
}

export default function EventsModal({
  isOpen,
  onClose,
  events
}: EventsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-sm rounded-lg shadow-lg p-4 relative">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg"
          aria-label="Close"
        >
          ×
        </button>

        {/* Title */}
        <h2 className="text-base font-semibold mb-3 text-center">
          Sự kiện – Ghi chú
        </h2>

        {/* Content */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto text-sm">
          {events.length === 0 && (
            <p className="text-center text-gray-500 text-sm">
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

        {/* Footer */}
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
