import { LEGAL, isImpressumComplete } from '../../data/legalConfig'
import LegalPageShell from './LegalPageShell'

interface ImpressumProps {
  onHome: () => void
}

/**
 * § 5 TMG-style "Impressum" (provider identification). Every field is
 * read from data/legalConfig.ts — nothing here is invented. Fields the
 * owner hasn't filled in yet render a visible "not yet provided" note
 * instead of a fabricated value or a blank line, and the page shows one
 * overall notice at the top while any required field is still empty —
 * see docs/legal-setup.md for the pre-launch checklist.
 */
export default function Impressum({ onHome }: ImpressumProps) {
  const complete = isImpressumComplete()

  return (
    <LegalPageShell title="Impressum" lastUpdated={LEGAL.lastUpdated} onHome={onHome}>
      {!complete && (
        <div className="rounded-2xl border-2 border-shuttle-500/50 bg-shuttle-100/60 dark:bg-shuttle-500/10 p-4 text-sm text-ink-900 dark:text-shuttle-50">
          <strong>This page is not yet complete.</strong> One or more legally-required fields (see <code>src/data/legalConfig.ts</code>) still need
          to be filled in by the site owner before this page can be relied on for compliance. See <code>docs/legal-setup.md</code> for the full
          checklist.
        </div>
      )}

      <section>
        <h2>Angaben gemäß § 5 TMG</h2>
        <p>
          {LEGAL.legalName}
          {LEGAL.tradingAs && LEGAL.tradingAs !== LEGAL.legalName ? ` (${LEGAL.tradingAs})` : ''}
        </p>
        <p>{LEGAL.addressLine1 || <Placeholder text="Street and house number — not yet provided" />}</p>
        <p>{LEGAL.addressLine2 || <Placeholder text="Postal code and city — not yet provided" />}</p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a href={`mailto:${LEGAL.email}`} className="underline">
            {LEGAL.email}
          </a>
        </p>
        <p>Telefon: {LEGAL.phone || <Placeholder text="Not yet provided" />}</p>
      </section>

      {(LEGAL.vatId || LEGAL.registrationNumber) && (
        <section>
          <h2>Registrierung</h2>
          {LEGAL.vatId && <p>Umsatzsteuer-Identifikationsnummer: {LEGAL.vatId}</p>}
          {LEGAL.registrationNumber && (
            <p>
              {LEGAL.registrationNumber}
              {LEGAL.registrationAuthority ? ` (${LEGAL.registrationAuthority})` : ''}
            </p>
          )}
        </section>
      )}

      <section>
        <h2>Verantwortlich für den Inhalt</h2>
        <p>{LEGAL.legalName}, wie oben angegeben.</p>
      </section>

      <section>
        <h2>EU-Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a href={LEGAL.euOdrUrl} target="_blank" rel="noopener noreferrer">
            {LEGAL.euOdrUrl}
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen, sofern
          dies nicht gesondert angegeben ist.
        </p>
      </section>

      <section>
        <h2>Haftungshinweis</h2>
        <p>
          Diese Seite wird mit Sorgfalt gepflegt, es kann jedoch keine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität der
          bereitgestellten Informationen übernommen werden. Für Inhalte externer Links (z. B. Händler-Websites) sind ausschließlich deren
          Betreiber verantwortlich.
        </p>
      </section>
    </LegalPageShell>
  )
}

function Placeholder({ text }: { text: string }) {
  return <span className="italic text-shuttle-600 dark:text-shuttle-400">[{text}]</span>
}
