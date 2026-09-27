import { MessageSquarePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Conversation } from '../types/api'

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: {
  conversations: Conversation[]
  activeId?: string
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [menuId, setMenuId] = useState<string | null>(null)

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-sylc-line bg-white/75">
      <div className="border-b border-sylc-line p-2">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-[7px] bg-sylc-sky/70 px-3 py-2 text-sm font-medium hover:bg-sylc-sky"
        >
          <MessageSquarePlus size={15} /> New conversation
        </button>
      </div>
      <div className="sylc-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-sylc-muted">
            Your conversations will appear here.
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative rounded-[7px] ${activeId === conversation.id ? 'bg-sylc-twilight/30' : 'hover:bg-slate-100'}`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className="w-full truncate px-2.5 py-2 pr-8 text-left text-xs text-slate-700"
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  aria-label="Conversation actions"
                  onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded opacity-0 hover:bg-white group-hover:opacity-100"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuId === conversation.id && (
                  <div className="absolute right-1 top-8 z-20 w-32 rounded-[7px] border border-sylc-line bg-white p-1 text-xs shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt('Rename conversation', conversation.title)
                        if (next?.trim()) onRename(conversation.id, next.trim())
                        setMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                    >
                      <Pencil size={12} /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(conversation.id)
                        setMenuId(null)
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
