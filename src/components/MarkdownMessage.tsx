import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="my-3 overflow-hidden rounded-[7px] border border-sylc-line bg-white">
      <div className="flex items-center justify-between border-b border-sylc-line bg-slate-50 px-3 py-1.5 text-[11px] text-sylc-muted">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-1 hover:text-slate-900"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneLight}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: 13, background: '#fff' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="message-markdown text-[15px] text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? '')
            const code = String(children).replace(/\n$/, '')
            if (match || code.includes('\n')) {
              return <CodeBlock language={match?.[1] ?? 'text'} code={code} />
            }
            return (
              <code
                className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900"
                {...props}
              >
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
