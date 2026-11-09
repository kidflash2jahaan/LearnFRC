import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PrintButton } from "@/components/certificate/print-button";
import { InviteQr } from "@/components/team/invite-qr";
import { FIRST_DISCLAIMER } from "@/lib/applications";
import { SITE_URL, classesVisible } from "@/lib/classes/config";
import { COORDINATOR } from "@/lib/classes/coordinator";
import { getLetterForViewer } from "@/lib/classes/letters";
import {
  NOT_A_NONPROFIT,
  hoursAndMinutes,
  letterParagraphs,
  longDate,
  shortDate,
  verifyUrlFor,
  verifyUrlLabel,
} from "@/lib/classes/letter-rules";

export const metadata: Metadata = {
  // Never the code or the name: titles end up in browser history and tabs.
  title: "Hours letter",
  robots: { index: false, follow: false },
};

/**
 * /letters/[code]: a signed hours letter, ready to print on one page
 * (classes-design.md section 9.2 step 4), in the certificate page's
 * print style. Its teacher, the safety lead and super admins only
 * (getLetterForViewer); anyone else gets the same 404 as a code that
 * doesn't exist, so the page never says whether a letter is there.
 *
 * Signed out, it sends people to sign in and come back through their letters
 * page rather than this URL, so the code doesn't ride along in a login link.
 *
 * Issued letters stay readable even if classes are switched off later: a
 * teacher may need to print one again after handing it in.
 */

/** Only the letter prints, black on white, portrait, from the top of the sheet. */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #letter, #letter * { visibility: visible !important; }
  #letter {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 10pt;
    line-height: 1.38;
  }
  #letter .letter-table td, #letter .letter-table th { padding-top: 0.18rem; padding-bottom: 0.18rem; }
  #letter.letter-long { font-size: 9pt; }
  #letter.letter-long .letter-table { font-size: 8pt; }
  #letter, #letter * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  @page { size: portrait; margin: 0.5in; }
}
`;

/** The site's mark (src/app/icon.svg), drawn inline so the letter never waits on an image. */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true" className="shrink-0">
      <path
        d="M6.9 4.5H26.4A1.7 1.7 0 0 1 28.1 6.2V24.4A3.1 3.1 0 0 1 25 27.5H5.6A1.9 1.9 0 0 1 3.7 25.6V7.7A3.2 3.2 0 0 1 6.9 4.5Z"
        fill="#F5F6F2"
        stroke="#16181B"
        strokeWidth="2"
      />
      <path d="M8.4 13.1h15.2" stroke="#16181B" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M8.4 20.3h8.1" stroke="#1B36C8" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M17.9 3.4L27.6 1.9 28.7 8.4 19 9.9Z" fill="#C4A77D" opacity="0.85" />
    </svg>
  );
}

export default async function LetterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { user } = await getSession();
  if (!user) {
    // While classes are hidden, a signed-out visitor gets a plain 404, so the
    // login link doesn't name a classes page before launch.
    if (!(await classesVisible())) notFound();
    redirect("/login?next=/classes/teaching/letter");
  }

  const found = await getLetterForViewer(user, code);
  if (!found) notFound();
  const { letter, viewer } = found;
  const withdrawn = letter.status === "revoked";

  const p = letterParagraphs({
    name: letter.letterName,
    start: letter.start,
    end: letter.end,
    classCount: letter.classCount,
    totalMinutes: letter.totalMinutes,
  });
  const verifyUrl = verifyUrlFor(SITE_URL, letter.code);
  const mailingAddress = process.env.MAILING_ADDRESS?.trim() || null;
  const long = letter.classes.length > 14;

  return (
    <section className="nb-wrap pb-[clamp(3rem,6vw,5rem)] pt-[clamp(1.6rem,4vw,2.8rem)]">
      <style>{PRINT_CSS}</style>

      <div className="mx-auto max-w-[52rem]">
        {/* Chrome. Never printed. */}
        <div className="mb-[clamp(1.2rem,2.6vw,1.8rem)] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={viewer === "owner" ? "/classes/teaching/letter" : "/admin/classes/letters"}
            className="nb-navlink"
          >
            {viewer === "owner" ? "back to your letters" : "back to the letters desk"}
          </Link>
          {withdrawn ? null : <PrintButton />}
        </div>

        {withdrawn ? (
          <div className="nb-note mb-[clamp(1.2rem,2.6vw,1.8rem)] print:hidden" role="status">
            <p className="nb-slug">withdrawn</p>
            <p className="mt-1.5 text-[0.95rem] leading-snug">
              This letter was withdrawn on {longDate(letter.revokedOn ?? letter.issuedOn)} and isn&rsquo;t valid any
              more. Its verify page says so.
              {letter.revokedReason ? ` Why: ${letter.revokedReason}` : ""}
            </p>
          </div>
        ) : (
          <p className="nb-hint mb-[clamp(1rem,2.2vw,1.4rem)] print:hidden">
            It prints on one page. Choose &quot;save as PDF&quot; in the print window to keep a copy.
          </p>
        )}

        <article
          id="letter"
          className={`${long ? "letter-long " : ""}relative border-2 border-ink bg-white px-[clamp(1.2rem,4vw,3rem)] py-[clamp(1.4rem,4vw,2.6rem)] text-[0.98rem] leading-relaxed text-ink`}
        >
          {withdrawn ? (
            <p className="mb-4 border-2 border-ink px-3 py-1.5 text-center font-extrabold uppercase tracking-[0.2em]">
              Withdrawn on {longDate(letter.revokedOn ?? letter.issuedOn)}: not valid
            </p>
          ) : null}

          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink pb-3">
            <div className="flex items-center gap-3">
              <Mark />
              <div>
                <p className="text-[1.35rem] font-extrabold leading-none tracking-[-0.02em]">LearnFRC</p>
                <p className="mt-1 font-mono text-[0.78rem] text-graphite">learnfrc.com</p>
              </div>
            </div>
            <p className="text-right">{longDate(letter.issuedOn)}</p>
          </header>

          <p className="mt-5">To whom it may concern,</p>
          <p className="mt-3">{p.confirms}</p>
          <p className="mt-3">{p.howChecked}</p>

          <table className="letter-table mt-4 w-full border-collapse text-[0.9rem]" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th scope="col" className="py-1 pr-3 font-bold">
                  Date
                </th>
                <th scope="col" className="py-1 pr-3 font-bold">
                  Class
                </th>
                <th scope="col" className="py-1 pr-3 font-bold">
                  Topic
                </th>
                <th scope="col" className="py-1 text-right font-bold">
                  Minutes
                </th>
              </tr>
            </thead>
            <tbody>
              {letter.classes.map((c) => (
                <tr key={c.classId} className="border-b border-rule align-top">
                  <td className="whitespace-nowrap py-1 pr-3">{shortDate(c.date)}</td>
                  <td className="py-1 pr-3">{c.title}</td>
                  <td className="py-1 pr-3">{c.topic ?? ""}</td>
                  <td className="py-1 text-right">{c.minutes}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink">
                <td className="py-1 pr-3 font-bold" colSpan={3}>
                  Total: {letter.classCount} {letter.classCount === 1 ? "class" : "classes"},{" "}
                  {hoursAndMinutes(letter.totalMinutes)}
                </td>
                <td className="py-1 text-right font-bold">{letter.totalMinutes}</td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="font-bold">/s/ {letter.coordinatorName}</p>
              <p>{COORDINATOR.letterTitle}, LearnFRC</p>
              <p>{letter.coordinatorEmail}</p>
              {mailingAddress ? <p className="whitespace-pre-line">{mailingAddress}</p> : null}
              <p className="mt-2 text-[0.88rem]">Reviewed and approved by the signer on {longDate(letter.issuedOn)}.</p>
            </div>
            <div className="flex items-center gap-3">
              <InviteQr url={verifyUrl} title="QR code for this letter's verify page" className="size-[5.6rem] shrink-0" />
              <p className="max-w-[15rem] text-[0.85rem] leading-snug">
                Verify this letter at <span className="break-all font-mono font-bold">{verifyUrlLabel(SITE_URL, letter.code)}</span>
              </p>
            </div>
          </div>

          <footer className="mt-6 border-t border-ink pt-2 text-[0.72rem] leading-snug text-graphite">
            <p>{NOT_A_NONPROFIT}</p>
            <p className="mt-1">{FIRST_DISCLAIMER}</p>
            <p className="mt-1 font-mono">Letter {letter.code}</p>
          </footer>
        </article>
      </div>
    </section>
  );
}
