import { Check, Copy, Download, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

export function AccessCodePanel({
  accessCode,
  onContinue,
}: {
  accessCode: string
  onContinue: () => void
}) {
  const [copied, setCopied] = useState(false)
  const formatted = `${accessCode.slice(0, 4)} ${accessCode.slice(4, 8)} ${accessCode.slice(8)}`

  async function copyCode() {
    await navigator.clipboard.writeText(accessCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function downloadCode() {
    const blob = new Blob(
      [
        `Sylc profile access code\n\n${accessCode}\n\nKeep this code private. Anyone with it may be able to restore your Sylc profile.\n`,
      ],
      { type: 'text/plain;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'sylc-access-code.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-[7px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <ShieldAlert className="mt-0.5 shrink-0" size={18} />
        <p>
          Save this code now. Sylc shows it only at creation or regeneration time. Losing it may
          make the profile unrecoverable.
        </p>
      </div>
      <div className="rounded-[7px] border border-sylc-line bg-slate-950 px-4 py-5 text-center">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          12-digit access code
        </div>
        <div className="mt-2 font-mono text-2xl tracking-[0.12em] text-white">{formatted}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void copyCode()}
          className="flex items-center justify-center gap-2 rounded-[7px] border border-sylc-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={downloadCode}
          className="flex items-center justify-center gap-2 rounded-[7px] border border-sylc-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <Download size={15} /> Download
        </button>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-[7px] bg-sylc-sky-strong px-4 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-95"
      >
        I saved my code — open Sylc
      </button>
    </div>
  )
}
