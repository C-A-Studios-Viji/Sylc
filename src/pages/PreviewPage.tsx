import {
  ArrowRight,
  Bot,
  Boxes,
  KeyRound,
  LockKeyhole,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'

type Section = 'chat' | 'models' | 'connections'
type Provider = 'Medalion' | 'YiNi'

const sections = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'models', label: 'Models', icon: Boxes },
  { id: 'connections', label: 'Connections', icon: KeyRound },
] as const

const setupUrl = 'https://github.com/C-A-Studios-Viji/Sylc#hosted-supabase-deployment'

export function PreviewPage() {
  const [section, setSection] = useState<Section>('chat')
  const [provider, setProvider] = useState<Provider>('Medalion')

  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-sylc-line bg-white/90 p-3 md:flex md:flex-col md:border-b-0 md:border-r md:p-4">
        <div className="flex items-center gap-2 px-2 py-1 md:mb-8">
          <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-sylc-sky text-slate-900">
            <Bot size={19} />
          </span>
          <div>
            <div className="text-base font-semibold tracking-tight">Sylc</div>
            <div className="text-[11px] text-sylc-muted">your AI workspace</div>
          </div>
          <span className="ml-auto rounded-full bg-sylc-twilight/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 md:hidden">
            Preview
          </span>
        </div>
        <nav
          className="mt-3 flex gap-1 md:mt-0 md:block md:space-y-1"
          aria-label="Preview sections"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3 py-2 text-sm transition md:w-full md:justify-start ${
                section === id
                  ? 'bg-sylc-sky/60 font-medium text-slate-950'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-sylc-line px-2 pt-4 md:block">
          <div className="text-xs font-semibold text-slate-800">Interface preview</div>
          <div className="mt-1 text-[11px] leading-5 text-sylc-muted">
            Your profile and keys will be available after the backend is connected.
          </div>
        </div>
      </aside>

      <main className="flex min-h-[calc(100vh-117px)] min-w-0 flex-col md:min-h-screen">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sylc-line bg-white/90 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles size={16} className="text-sylc-gold" />
            {section === 'chat'
              ? 'New conversation'
              : section === 'models'
                ? 'Model browser'
                : 'Connections'}
          </div>
          <span className="rounded-full border border-sylc-line bg-sylc-panel px-2.5 py-1 text-[11px] font-medium text-slate-600">
            Preview mode
          </span>
        </div>

        {section === 'chat' ? (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-sylc-line bg-white/70 px-5 py-2.5">
              <label className="sr-only" htmlFor="preview-provider">
                Provider
              </label>
              <select
                id="preview-provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value as Provider)}
                className="h-9 rounded-[7px] border border-sylc-line bg-white px-3 text-xs font-medium"
              >
                <option>Medalion</option>
                <option>YiNi</option>
              </select>
              <span className="flex h-9 min-w-48 items-center rounded-[7px] border border-sylc-line bg-slate-50 px-3 text-xs text-sylc-muted">
                Connect {provider} to load models
              </span>
            </div>

            <div className="grid flex-1 place-items-center px-5 py-12">
              <div className="w-full max-w-xl text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-[16px] border border-white/70 bg-[linear-gradient(135deg,#bfe7ff,#cad0e2,#f4dfaa)] shadow-sm">
                  <Sparkles size={25} className="text-slate-800" />
                </div>
                <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-sylc-gold">
                  Sylc
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  What are we working on?
                </h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-sylc-muted">
                  One conversation, your choice of model. Switch models without losing the thread.
                </p>
                <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                  <div className="rounded-[10px] border border-sylc-line bg-white/80 p-4 shadow-sm">
                    <Boxes size={18} className="text-sylc-twilight-deep" />
                    <div className="mt-3 text-sm font-semibold">Four models, one space</div>
                    <p className="mt-1 text-xs leading-5 text-sylc-muted">
                      Zen and Strato lead Medalion. Kami and Zex are ready for coding in YiNi.
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-sylc-line bg-white/80 p-4 shadow-sm">
                    <ShieldCheck size={18} className="text-sylc-gold" />
                    <div className="mt-3 text-sm font-semibold">A profile that travels</div>
                    <p className="mt-1 text-xs leading-5 text-sylc-muted">
                      Restore your settings and encrypted connections with a private access code.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-sylc-line bg-white p-4">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-end gap-2 rounded-[9px] border border-sylc-line bg-slate-50 p-2.5">
                  <span className="flex-1 px-2 py-1.5 text-sm text-slate-400">
                    Connect the backend to message Sylc…
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-[7px] bg-sylc-sky/65 text-slate-500">
                    <Send size={15} />
                  </span>
                </div>
                <p className="mt-2 text-center text-[11px] text-sylc-muted">
                  Preview only · No messages or API keys are accepted on this page.
                </p>
              </div>
            </div>
          </div>
        ) : section === 'models' ? (
          <div className="mx-auto w-full max-w-4xl px-5 py-10">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sylc-gold">
              Live catalogue
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Find your model</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sylc-muted">
              Sylc loads available models from your connected tier. The catalogue appears here after
              setup.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {(['Medalion', 'YiNi'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setProvider(name)
                    setSection('chat')
                  }}
                  className="flex items-center justify-between rounded-[10px] border border-sylc-line bg-white p-5 text-left shadow-sm hover:border-sylc-sky-strong"
                >
                  <span>
                    <span className="block text-sm font-semibold">{name}</span>
                    <span className="mt-1 block text-xs text-sylc-muted">
                      {name === 'Medalion' ? 'Zen · Strato' : 'Kami · Zex'}
                    </span>
                  </span>
                  <ArrowRight size={17} className="text-sylc-muted" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl px-5 py-10">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sylc-gold">
              Secure setup
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Connect Sylc</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sylc-muted">
              The interface is live. Profile creation, encrypted API keys, and AI chat need a
              Supabase project and its Edge Functions.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] border border-sylc-line bg-white p-5 shadow-sm">
                <LockKeyhole size={19} className="text-sylc-twilight-deep" />
                <h2 className="mt-3 text-sm font-semibold">Profile vault</h2>
                <p className="mt-1 text-xs leading-5 text-sylc-muted">
                  Your recovery code and connections are handled by the backend, not stored in this
                  preview.
                </p>
              </div>
              <div className="rounded-[10px] border border-sylc-line bg-white p-5 shadow-sm">
                <KeyRound size={19} className="text-sylc-gold" />
                <h2 className="mt-3 text-sm font-semibold">Your keys</h2>
                <div className="mt-3 space-y-2">
                  {(['Medalion', 'YiNi'] as const).map((tier) => (
                    <label key={tier} className="block text-xs font-medium">
                      {tier} key
                      <input
                        type="password"
                        disabled
                        placeholder="Available after secure setup"
                        className="mt-1 block h-9 w-full rounded border border-sylc-line bg-slate-50 px-3"
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs leading-5 text-sylc-muted">
                  Key entry becomes available only after the secure vault is deployed.
                </p>
              </div>
            </div>
            <a
              href={setupUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-[7px] bg-sylc-sky-strong px-4 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-95"
            >
              Backend setup guide <ArrowRight size={15} />
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
