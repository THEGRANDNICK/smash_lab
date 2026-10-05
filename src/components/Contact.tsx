import { CONTACT } from '../data/contact'

const WHATSAPP_URL = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent('Hi Nick! I have a question about Smash Lab.')}`

export default function Contact() {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto scroll-mt-20">
      <div className="text-center mb-10">
        <p className="tape">Get in touch</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Say hello</h2>
        <p className="text-ink-700/70 dark:text-shuttle-100/70 mt-3">
          Got a question about a string or your setup? Message me — I usually reply within a day.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 card-stock p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ContactRow emoji="👤" label="Name" value={CONTACT.name} />
          <ContactRow emoji="📍" label="Location" value={CONTACT.location} />
          <ContactRow emoji="✉️" label="Email" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
          <ContactRow emoji="💬" label="WhatsApp" value="Message on WhatsApp" href={WHATSAPP_URL} external />
        </div>

      </div>
    </section>
  )
}

function ContactRow({ emoji, label, value, href, external }: { emoji: string; label: string; value: string; href?: string; external?: boolean }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className="text-2xl shrink-0" aria-hidden="true">
        {emoji}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/70 dark:text-shuttle-100/50">{label}</p>
        {href ? (
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="font-semibold text-ink-900 dark:text-shuttle-50 hover:underline hover:text-shuttle-700 dark:hover:text-shuttle-400 [overflow-wrap:normal] [word-break:keep-all]"
          >
            {withEmailBreak(value)}
          </a>
        ) : (
          <p className="font-semibold text-ink-900 dark:text-shuttle-50 break-words">{value}</p>
        )}
      </div>
    </div>
  )
}

/** Lets a long e-mail address wrap after the "@" instead of mid-word ("…gmail.co / m"). */
function withEmailBreak(value: string) {
  const at = value.indexOf('@')
  if (at === -1) return value
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  )
}
