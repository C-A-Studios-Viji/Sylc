import {
  Bot,
  Boxes,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MarkdownMessage } from '../components/MarkdownMessage'
import { loadAliases, readKeys, saveKey, sendDirectChat, type ChatTurn } from '../lib/direct-chat'
import { tierName, type ModelAlias } from '../lib/model-aliases'
import type { Provider } from '../types/api'

type Section = 'chat' | 'models'
type Conversation = { id: string; title: string; messages: ChatTurn[] }
const providers: Provider[] = ['openrouter', 'mistral']

export function PreviewPage() {
  const [section, setSection] = useState<Section>('chat')
  const [keys, setKeys] = useState(readKeys)
  const [drafts, setDrafts] = useState<Partial<Record<Provider, string>>>({})
  const [visible, setVisible] = useState<Partial<Record<Provider, boolean>>>({})
  const [aliases, setAliases] = useState<Partial<Record<Provider, ModelAlias[]>>>({})
  const [selected, setSelected] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [input, setInput] = useState('')
  const [streamed, setStreamed] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState<Provider | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const allModels = [...(aliases.openrouter ?? []), ...(aliases.mistral ?? [])]
  const current = allModels.find((alias) => alias.name === selected) ?? allModels[0]
  const active = conversations.find((conversation) => conversation.id === activeId)

  useEffect(() => {
    let mounted = true
    for (const provider of providers) {
      const key = readKeys()[provider]
      if (!key) continue
      void loadAliases(provider, key)
        .then((models) => {
          if (mounted) setAliases((previous) => ({ ...previous, [provider]: models }))
        })
        .catch(() => {
          /* The user can retry from Models. */
        })
    }
    return () => {
      mounted = false
    }
  }, []) // Restore keys already entered in this browser tab.

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [conversations, streamed])

  async function connect(provider: Provider) {
    const key = drafts[provider]?.trim()
    if (!key) return
    setLoading(provider)
    setError('')
    try {
      const models = await loadAliases(provider, key)
      if (!models.length)
        throw new Error(`${tierName[provider]} has no chat models available for this key.`)
      saveKey(provider, key)
      setKeys(readKeys())
      setAliases((previous) => ({ ...previous, [provider]: models }))
      if (!current || (provider === 'openrouter' && !keys.openrouter))
        setSelected(models[0]?.name ?? '')
      setDrafts((previous) => ({ ...previous, [provider]: '' }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not connect this key.')
    } finally {
      setLoading(null)
    }
  }

  function disconnect(provider: Provider) {
    saveKey(provider, '')
    setKeys(readKeys())
    setAliases((previous) => ({ ...previous, [provider]: [] }))
    if (current?.provider === provider) setSelected('')
  }

  async function submit() {
    const text = input.trim()
    if (!text || busy) return
    if (!current || !keys[current.provider]) {
      setSection('models')
      setError('Paste a key to start chatting.')
      return
    }
    const id = activeId || crypto.randomUUID()
    const previous = active?.messages ?? []
    const messages: ChatTurn[] = [...previous, { role: 'user', content: text }]
    setConversations((items) =>
      activeId
        ? items.map((item) => (item.id === id ? { ...item, messages } : item))
        : [{ id, title: text.slice(0, 48), messages }, ...items],
    )
    setActiveId(id)
    setInput('')
    setError('')
    setStreamed('')
    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const answer = await sendDirectChat(
        current.provider,
        keys[current.provider]!,
        current.modelId,
        messages,
        setStreamed,
        controller.signal,
        (aliases[current.provider] ?? []).map((alias) => alias.modelId),
      )
      if (answer)
        setConversations((items) =>
          items.map((item) =>
            item.id === id
              ? { ...item, messages: [...messages, { role: 'assistant', content: answer }] }
              : item,
          ),
        )
    } catch (caught) {
      setError(
        controller.signal.aborted
          ? 'Generation stopped.'
          : caught instanceof Error
            ? caught.message
            : 'Generation failed.',
      )
    } finally {
      setBusy(false)
      setStreamed('')
      abortRef.current = null
    }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-sylc-line bg-white/90 p-3 md:flex md:flex-col md:border-b-0 md:border-r md:p-4">
        <div className="flex items-center gap-2 px-2 py-1 md:mb-7">
          <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-sylc-sky">
            <Bot size={19} />
          </span>
          <div>
            <div className="font-semibold">Sylc</div>
            <div className="text-[11px] text-sylc-muted">your AI workspace</div>
          </div>
        </div>
        <nav className="mt-3 flex gap-1 md:mt-0 md:block md:space-y-1" aria-label="Sections">
          {(
            [
              ['chat', 'Chat', MessageSquare],
              ['models', 'Models', Boxes],
            ] as const
          ).map(([id, name, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3 py-2 text-sm md:w-full md:justify-start ${section === id ? 'bg-sylc-sky/60 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon size={16} /> {name}
            </button>
          ))}
        </nav>
        {section === 'chat' && (
          <div className="mt-5 hidden min-h-0 flex-1 overflow-y-auto border-t border-sylc-line pt-3 md:block">
            <button
              type="button"
              onClick={() => setActiveId('')}
              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-slate-100"
            >
              <Plus size={14} /> New chat
            </button>
            {conversations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`block w-full truncate rounded px-2 py-2 text-left text-xs ${activeId === item.id ? 'bg-sylc-twilight/30' : 'hover:bg-slate-100'}`}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
        <p className="mt-auto hidden border-t border-sylc-line px-2 pt-4 text-[11px] leading-5 text-sylc-muted md:block">
          Keys stay in this browser tab. Chats disappear when you reload.
        </p>
      </aside>

      <main className="flex min-h-[calc(100vh-110px)] min-w-0 flex-col md:h-screen md:min-h-0">
        <header className="flex items-center justify-between border-b border-sylc-line bg-white/90 px-5 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Sparkles size={16} className="text-sylc-gold" />{' '}
            {section === 'chat' ? (active?.title ?? 'New conversation') : 'Models'}
          </span>
          {section === 'chat' && (
            <button className="md:hidden" onClick={() => setActiveId('')} aria-label="New chat">
              <Plus size={18} />
            </button>
          )}
        </header>
        {section === 'models' ? (
          <div className="mx-auto w-full max-w-4xl overflow-y-auto px-5 py-8">
            <h1 className="text-3xl font-semibold tracking-tight">Your models</h1>
            <p className="mt-2 text-sm text-sylc-muted">
              Paste a key for either tier. Sylc picks the first model automatically.
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {providers.map((provider) => (
                <section
                  key={provider}
                  className="rounded-[10px] border border-sylc-line bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{tierName[provider]}</h2>
                    <span className="text-xs text-sylc-muted">
                      {keys[provider] ? 'Connected' : 'Add key'}
                    </span>
                  </div>
                  <label className="mt-4 block text-xs font-medium" htmlFor={`${provider}-key`}>
                    {tierName[provider]} key
                  </label>
                  <div className="mt-1 flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <input
                        id={`${provider}-key`}
                        type={visible[provider] ? 'text' : 'password'}
                        value={drafts[provider] ?? ''}
                        onChange={(event) =>
                          setDrafts((previous) => ({ ...previous, [provider]: event.target.value }))
                        }
                        placeholder={keys[provider] ? 'Paste a replacement key' : 'Paste your key'}
                        autoComplete="off"
                        spellCheck={false}
                        className="h-10 w-full rounded border border-sylc-line px-3 pr-9 text-sm focus:border-sylc-sky-strong focus:outline-none"
                      />
                      <button
                        type="button"
                        aria-label={`Show ${tierName[provider]} key`}
                        onClick={() =>
                          setVisible((previous) => ({
                            ...previous,
                            [provider]: !previous[provider],
                          }))
                        }
                        className="absolute right-2 top-2.5 text-slate-500"
                      >
                        {visible[provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={!drafts[provider]?.trim() || Boolean(loading)}
                      onClick={() => void connect(provider)}
                      className="rounded bg-sylc-sky-strong px-3 text-xs font-semibold disabled:opacity-40"
                    >
                      {loading === provider ? 'Checking…' : 'Connect'}
                    </button>
                  </div>
                  {keys[provider] && (
                    <button
                      type="button"
                      onClick={() => disconnect(provider)}
                      className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"
                    >
                      <Trash2 size={13} /> Remove key
                    </button>
                  )}
                  <div className="mt-5 space-y-2">
                    {(aliases[provider] ?? []).map((alias) => (
                      <button
                        type="button"
                        key={alias.name}
                        onClick={() => {
                          setSelected(alias.name)
                          setSection('chat')
                          setError('')
                        }}
                        className={`flex w-full items-center justify-between rounded border p-3 text-left ${current?.name === alias.name ? 'border-sylc-sky-strong bg-sylc-sky/30' : 'border-sylc-line hover:border-sylc-sky-strong'}`}
                      >
                        <span>
                          <strong className="block text-sm">{alias.name}</strong>
                          <span className="text-xs text-sylc-muted">{alias.subtitle}</span>
                        </span>
                        <span className="text-xs text-sylc-muted">Use →</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-sylc-muted">
              Keys remain in this browser tab and are sent directly to the selected service. Closing
              the tab clears them. Current questions can use metered web search on your key; if
              search fails, Sylc answers with a freshness notice.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-sylc-line bg-white/70 px-5 py-2.5">
              <label htmlFor="model-select" className="text-xs text-sylc-muted">
                Model
              </label>
              <select
                id="model-select"
                value={current?.name ?? ''}
                onChange={(event) => setSelected(event.target.value)}
                className="h-9 rounded border border-sylc-line bg-white px-3 text-xs font-medium"
              >
                {!current && <option value="">Connect a key in Models</option>}
                {allModels.map((alias) => (
                  <option key={alias.name} value={alias.name}>
                    {alias.name} · {alias.tier}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSection('models')}
                className="text-xs text-sylc-muted underline"
              >
                Models
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
              <div className="mx-auto max-w-3xl space-y-4">
                {!active?.messages.length && (
                  <div className="py-20 text-center">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#bfe7ff,#cad0e2,#f4dfaa)]">
                      <Sparkles size={25} />
                    </div>
                    <h1 className="mt-6 text-3xl font-semibold">What are we working on?</h1>
                    <p className="mt-3 text-sm text-sylc-muted">
                      {current
                        ? `${current.name} is ready.`
                        : 'Open Models to paste a key and start chatting.'}
                    </p>
                  </div>
                )}
                {active?.messages.map((message, index) => (
                  <article
                    key={`${active.id}-${index}`}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg border px-4 py-3 text-sm ${message.role === 'user' ? 'border-sylc-sky bg-sylc-sky/40' : 'border-sylc-line bg-white'}`}
                    >
                      {message.role === 'assistant' ? (
                        <MarkdownMessage content={message.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </article>
                ))}
                {streamed && (
                  <article className="rounded-lg border border-sylc-line bg-white px-4 py-3 text-sm">
                    <MarkdownMessage content={streamed} />
                  </article>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
            <footer className="border-t border-sylc-line bg-white p-4">
              <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-sylc-line p-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void submit()
                    }
                  }}
                  placeholder="Message Sylc…"
                  rows={1}
                  className="max-h-40 min-h-9 flex-1 resize-none px-2 py-2 text-sm outline-none"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    aria-label="Stop generation"
                    className="rounded bg-slate-900 p-2 text-white"
                  >
                    <Square size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    aria-label="Send message"
                    disabled={!input.trim()}
                    className="rounded bg-sylc-sky-strong p-2 disabled:opacity-40"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}
