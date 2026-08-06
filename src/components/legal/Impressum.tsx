import { LEGAL } from '../../data/legalConfig'
import LegalPageShell from './LegalPageShell'

interface ImpressumProps {
  onHome: () => void
}

/**
 * § 5 TMG-style "Impressum" (provider identification). Every field is
 * read from data/legalConfig.ts — nothing here is invented. A field left
 * empty in that config (e.g. a full street address hasn't been supplied)
 * simply doesn't render its line — no "[placeholder]" text and no
 * incomplete-page banner on the rendered page. See docs/legal-setup.md
 * for what's currently configured and what a future full-address update
 * would add.
 */
export default function Impressum({ onHome }: ImpressumProps) {
  return (
    <LegalPageShell title="Impressum" lastUpdated={LEGAL.lastUpdated} onHome={onHome}>
      <section>
        <h2>Angaben gemäß § 5 TMG</h2>
        <p>
          {LEGAL.legalName}
          {LEGAL.tradingAs && LEGAL.tradingAs !== LEGAL.legalName ? ` (${LEGAL.tradingAs})` : ''}
        </p>
        {LEGAL.addressLine1 && <p>{LEGAL.addressLine1}</p>}
        {LEGAL.addressLine2 && <p>{LEGAL.addressLine2}</p>}
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a href={`mailto:${LEGAL.email}`} className="underline">
            {LEGAL.email}
          </a>
        </p>
        {LEGAL.phone && <p>Telefon / WhatsApp: {LEGAL.phone}</p>}
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
