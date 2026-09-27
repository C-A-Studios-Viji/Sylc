import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Pencil, RefreshCcw, Send, Square, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConversationSidebar } from '../components/ConversationSidebar'
import { MarkdownMessage } from '../components/MarkdownMessage'
import { Notice } from '../components/Notice'
import { ProviderMark } from '../components/ProviderMark'
import { Spinner } from '../components/Spinner'
import {
  deleteConversation,
  getConversation,
  getModels,
  listConversations,
  renameConversation,
  streamChat,
  updatePreferences,
} from '../lib/api'
import { useProfile } from '../lib/profile-context'
import type { Message, Provider } from '../types/api'

function MessageBubble({
  message,
  onRegenerate,
  onEdit,
}: {
  message: Message
  onRegenerate?: () => void
  onEdit?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const assistant = message.role === 'assistant'

  async function copy() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <article className={`group flex ${assistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[min(820px,90%)] rounded-[8px] border px-3.5 py-2.5 ${
          assistant ? 'border-sylc-line bg-white' : 'border-sylc-sky bg-sylc-sky/45'
        }`}
      >
        {assistant ? (
          <MarkdownMessage content={message.content} />
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-6">{message.content}</p>
        )}
        <div className="mt-2 flex items-center gap-2 border-t border-black/5 pt-1.5 text-[11px] text-sylc-muted opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1 hover:text-slate-900"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
          </button>
          {assistant && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1 hover:text-slate-900"
            >
              <RefreshCcw size={11} /> Regenerate
            </button>
          )}
          {!assistant && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1 hover:text-slate-900"
            >
              <Pencil size={11} /> Edit & resend
            </button>
          )}
          {message.provider && <ProviderMark provider={message.provider} />}
        </div>
      </div>
    </article>
  )
}

export function ChatPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile, replaceProfile } = useProfile()
  const [provider, setProvider] = useState<Provider>(
    profile?.preferences.selectedProvider ?? 'openrouter',
  )
  const [modelId, setModelId] = useState('')
  const [input, setInput] = useState('')
  const [streamingText, setStreamingText] = useState('')
  const [optimisticUser, setOptimisticUser] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showControls, setShowControls] = useState(false)
  const [temperature, setTemperature] = useState(profile?.preferences.temperature ?? 0.7)
  const [maxTokens, setMaxTokens] = useState(profile?.preferences.maxTokens ?? 4096)
  const [reasoningEffort, setReasoningEffort] = useState<
    'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  >('none')
  const controllerRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)

  const connected = useMemo(
    () => new Map(profile?.providers.map((item) => [item.provider, item.connected]) ?? []),
    [profile],
  )

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: listConversations,
  })

  const conversationQuery = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
  })

  const modelsQuery = useQuery({
    queryKey: ['models', provider],
    queryFn: () => getModels(provider),
    enabled: Boolean(connected.get(provider)),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    const preference =
      provider === 'openrouter'
        ? profile?.preferences.selectedModelOpenrouter
        : profile?.preferences.selectedModelMistral
    if (preference) {
      setModelId(preference)
      return
    }
    const featured = modelsQuery.data?.featured['best_overall']?.[0]
    const first = modelsQuery.data?.models[0]?.id
    if (!modelId && (featured || first)) setModelId(featured ?? first ?? '')
  }, [modelsQuery.data, profile, provider, modelId])

  useEffect(() => {
    stickToBottomRef.current = true
  }, [conversationId])

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !stickToBottomRef.current) return
    node.scrollTo({ top: node.scrollHeight, behavior: streamingText ? 'auto' : 'smooth' })
  }, [conversationQuery.data?.messages.length, streamingText, conversationId])

  async function persistSelection(nextProvider: Provider, nextModel: string) {
    try {
      const result = await updatePreferences({
        selectedProvider: nextProvider,
        selectedModel: nextModel,
      })
      replaceProfile(result.profile)
    } catch {
      // Selection remains local if preference persistence temporarily fails.
    }
  }

  async function runGeneration(options: {
    message: string
    mode?: 'send' | 'regenerate' | 'replace'
    messageId?: string
  }) {
    const text = options.message.trim()
    if (!text && options.mode !== 'regenerate') return
    if (!connected.get(provider)) {
      setError(`Connect ${provider === 'openrouter' ? 'OpenRouter' : 'Mistral'} before chatting.`)
      return
    }
    if (!modelId) {
      setError('Select a model first.')
      return
    }

    setBusy(true)
    setError('')
    setStreamingText('')
    setOptimisticUser(options.mode === 'send' ? text : null)
    const controller = new AbortController()
    controllerRef.current = controller
    let resolvedConversationId = conversationId

    try {
      await streamChat({
        conversationId,
        provider,
        modelId,
        message: text,
        temperature,
        maxTokens,
        reasoningEffort: provider === 'mistral' ? reasoningEffort : undefined,
        mode: options.mode,
        messageId: options.messageId,
        signal: controller.signal,
        onConversationId(id) {
          resolvedConversationId = id
          if (!conversationId) navigate(`/chat/${id}`, { replace: true })
        },
        onToken(token) {
          setStreamingText((current) => current + token)
        },
      })
      await queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (resolvedConversationId) {
        await queryClient.invalidateQueries({ queryKey: ['conversation', resolvedConversationId] })
      }
      setOptimisticUser(null)
      setStreamingText('')
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setError('Generation stopped.')
      } else {
        setError(caught instanceof Error ? caught.message : 'Generation failed.')
      }
    } finally {
      setBusy(false)
      controllerRef.current = null
    }
  }

  async function submit() {
    const message = input.trim()
    if (!message || busy) return
    setInput('')
    await runGeneration({ message, mode: 'send' })
  }

  const baseMessages = conversationQuery.data?.messages ?? []
  const tempUser: Message | null = optimisticUser
    ? {
        id: 'optimistic-user',
        conversationId: conversationId ?? 'new',
        role: 'user',
        content: optimisticUser,
        provider,
        modelId,
        createdAt: new Date().toISOString(),
      }
    : null
  const tempAssistant: Message | null = streamingText
    ? {
        id: 'streaming-assistant',
        conversationId: conversationId ?? 'new',
        role: 'assistant',
        content: streamingText,
        provider,
        modelId,
        createdAt: new Date().toISOString(),
      }
    : null
  const messages = [
    ...baseMessages,
    ...(tempUser ? [tempUser] : []),
    ...(tempAssistant ? [tempAssistant] : []),
  ]

  return (
    <div className="h-[calc(100vh-48px)] md:h-screen md:grid md:grid-cols-[220px_1fr]">
      <div className="hidden min-h-0 md:block">
        <ConversationSidebar
          conversations={conversationsQuery.data?.conversations ?? []}
          activeId={conversationId}
          onNew={() => navigate('/chat')}
          onSelect={(id) => navigate(`/chat/${id}`)}
          onRename={(id, title) => {
            void renameConversation(id, title).then(() =>
              queryClient.invalidateQueries({ queryKey: ['conversations'] }),
            )
          }}
          onDelete={(id) => {
            if (!window.confirm('Delete this conversation?')) return
            void deleteConversation(id).then(async () => {
              if (id === conversationId) navigate('/chat')
              await queryClient.invalidateQueries({ queryKey: ['conversations'] })
            })
          }}
        />
      </div>

      <section className="grid min-h-0 grid-rows-[auto_1fr_auto] bg-sylc-panel/40">
        <header className="border-b border-sylc-line bg-white/95 px-3 py-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <select
              value={conversationId ?? ''}
              onChange={(event) =>
                event.target.value ? navigate(`/chat/${event.target.value}`) : navigate('/chat')
              }
              className="h-8 w-full rounded-[7px] border border-sylc-line bg-white px-2 text-xs md:hidden"
              aria-label="Conversation history"
            >
              <option value="">New conversation</option>
              {conversationsQuery.data?.conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                </option>
              ))}
            </select>
            <select
              value={provider}
              onChange={(event) => {
                const next = event.target.value as Provider
                setProvider(next)
                setModelId('')
                void persistSelection(next, '')
              }}
              className="h-8 rounded-[7px] border border-sylc-line bg-white px-2 text-xs font-medium"
            >
              <option value="openrouter">OpenRouter</option>
              <option value="mistral">Mistral</option>
            </select>
            <select
              value={modelId}
              disabled={!connected.get(provider) || modelsQuery.isLoading}
              onChange={(event) => {
                const next = event.target.value
                setModelId(next)
                void persistSelection(provider, next)
              }}
              className="h-8 min-w-0 max-w-[420px] flex-1 rounded-[7px] border border-sylc-line bg-white px-2 text-xs disabled:bg-slate-50"
            >
              <option value="">{modelsQuery.isLoading ? 'Loading models…' : 'Select model'}</option>
              {modelsQuery.data?.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name || model.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowControls((current) => !current)}
              className="grid h-8 w-8 place-items-center rounded-[7px] border border-sylc-line bg-white text-slate-500 hover:text-slate-900"
              aria-label="Generation controls"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
          {showControls && (
            <div
              className={`mx-auto mt-2 grid max-w-5xl gap-2 rounded-[7px] border border-sylc-line bg-slate-50 p-2 text-xs ${provider === 'mistral' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
            >
              <label className="flex items-center gap-2">
                <span className="w-24 text-sylc-muted">Temperature</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                  className="flex-1"
                />
                <span className="w-7 text-right">{temperature.toFixed(1)}</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-20 text-sylc-muted">Max tokens</span>
                <input
                  type="number"
                  min="128"
                  max="32768"
                  value={maxTokens}
                  onChange={(event) => setMaxTokens(Number(event.target.value))}
                  className="h-7 w-28 rounded border border-sylc-line bg-white px-2"
                />
              </label>
              {provider === 'mistral' && (
                <label className="flex items-center gap-2">
                  <span className="w-20 text-sylc-muted">Reasoning</span>
                  <select
                    value={reasoningEffort}
                    onChange={(event) =>
                      setReasoningEffort(event.target.value as typeof reasoningEffort)
                    }
                    className="h-7 flex-1 rounded border border-sylc-line bg-white px-2"
                  >
                    <option value="none">Off / model default</option>
                    <option value="minimal">Minimal</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="xhigh">Extra high</option>
                  </select>
                </label>
              )}
            </div>
          )}
        </header>

        <div
          ref={scrollRef}
          onScroll={(event) => {
            const node = event.currentTarget
            stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120
          }}
          className="sylc-scrollbar min-h-0 overflow-y-auto px-3 py-5"
        >
          <div className="mx-auto max-w-4xl space-y-3">
            {!connected.get(provider) && (
              <Notice tone="warning">
                This provider is not connected.{' '}
                <Link className="font-medium underline" to="/settings/providers">
                  Add an API key
                </Link>
                .
              </Notice>
            )}
            {error && <Notice tone="error">{error}</Notice>}
            {conversationId && conversationQuery.isLoading && (
              <Spinner label="Loading conversation" />
            )}
            {messages.length === 0 && !conversationQuery.isLoading && (
              <div className="mx-auto max-w-lg py-24 text-center">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-sylc-gold">
                  Sylc
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                  What are we working on?
                </h1>
                <p className="mt-2 text-sm leading-6 text-sylc-muted">
                  Pick a connected provider and model above. You can switch either one
                  mid-conversation without losing the thread.
                </p>
              </div>
            )}
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === 'assistant' && index === messages.length - 1 && !busy
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onRegenerate={
                    isLastAssistant
                      ? () =>
                          void runGeneration({
                            message: '',
                            mode: 'regenerate',
                            messageId: message.id,
                          })
                      : undefined
                  }
                  onEdit={
                    message.role === 'user' && !message.id.startsWith('optimistic')
                      ? () => {
                          const edited = window.prompt('Edit message and resend', message.content)
                          if (edited?.trim() && edited.trim() !== message.content) {
                            void runGeneration({
                              message: edited.trim(),
                              mode: 'replace',
                              messageId: message.id,
                            })
                          }
                        }
                      : undefined
                  }
                />
              )
            })}
          </div>
        </div>

        <footer className="border-t border-sylc-line bg-white px-3 py-3">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-end gap-2 rounded-[8px] border border-sylc-line bg-white p-2 shadow-sm focus-within:border-sylc-sky-strong">
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
                className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-sm outline-none"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => controllerRef.current?.abort()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[7px] bg-slate-900 text-white"
                  aria-label="Stop generation"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!input.trim() || !connected.get(provider) || !modelId}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-[7px] bg-sylc-sky-strong text-slate-950 disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-sylc-muted">
              <span>
                {provider === 'openrouter' ? 'OpenRouter' : 'Mistral'} ·{' '}
                {modelId || 'no model selected'}
              </span>
              <span>Keys stay server-side</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  )
}
