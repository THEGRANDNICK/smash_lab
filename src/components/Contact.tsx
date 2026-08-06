import { CONTACT } from '../data/contact'
import { SERVICE_CONFIG } from '../data/serviceConfig'

const WHATSAPP_URL = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent('Hi Nick! I have a question about Smash Lab.')}`

export default function Contact() {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto scroll-mt-20">
      <div className="text-center mb-10">
        <p className="text-shuttle-600 font-semibold tracking-wide uppercase">Get in touch</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Say hello</h2>
        <p className="text-ink-700/70 dark:text-shuttle-100/70 mt-3">
          Got a question about a string, your setup, or a restring? Message me directly — I usually reply within a day.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ContactRow emoji="👤" label="Name" value={CONTACT.name} />
          <ContactRow emoji="📍" label="Location" value={CONTACT.location} />
          <ContactRow emoji="✉️" label="Email" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
          <ContactRow emoji="💬" label="WhatsApp" value="Message on WhatsApp" href={WHATSAPP_URL} external />
        </div>

        <p className="mt-6 pt-6 border-t border-court-900/10 dark:border-white/10 text-center text-sm text-ink-700/60 dark:text-shuttle-100/60">
          🕒 {SERVICE_CONFIG.turnaroundNote}
        </p>
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">{label}</p>
        {href ? (
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="font-semibold text-ink-900 dark:text-shuttle-50 hover:underline hover:text-shuttle-600 dark:hover:text-shuttle-400 break-words"
          >
            {value}
          </a>
        ) : (
          <p className="font-semibold text-ink-900 dark:text-shuttle-50 break-words">{value}</p>
        )}
      </div>
    </div>
  )
}
