// NOTE: These are standard placeholder Terms drafted as a starting point.
// Have them reviewed by a lawyer before launch — refund, cancellation, and
// auto-renewal terms are regulated differently by region.

import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions · Love Letter",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#fbf6f1] px-5 py-10 text-[#161313] sm:px-8 sm:py-14 lg:px-12">
      <div className="mx-auto w-full max-w-[760px]">
        <header className="text-center">
          <p className="font-serif text-2xl tracking-[0.2em] sm:text-3xl">
            LOVE LETTER <span className="text-[#c97972]">♡</span>
          </p>
          <h1 className="mt-6 font-serif text-4xl leading-tight sm:text-5xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-3 text-sm text-[#6f5b58]">Last updated June 2026</p>
        </header>

        <div className="mt-10 space-y-8 text-base leading-8 text-[#4e4440]">
          <p>
            Welcome to Love Letter. These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your
            use of the Love Letter website and service (the &ldquo;Service&rdquo;). By creating an
            account or using the Service, you agree to these Terms. Please read them carefully.
          </p>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">1. The Service</h2>
            <p className="mt-3">
              Love Letter is a monthly relationship ritual. Each cycle, both partners receive the
              same guided prompt, privately write a letter, and the letters unlock together on the
              reveal day (the 15th of the month). The digital experience is free. An optional
              Premium subscription adds a printed copy of your letters, mailed to both partners.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">2. Accounts &amp; eligibility</h2>
            <p className="mt-3">
              You must be at least 18 years old to use the Service. You are responsible for the
              accuracy of the information you provide and for keeping access to your email secure,
              since sign-in uses email-based links. You are responsible for activity that occurs
              under your account.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">3. Partners &amp; invitations</h2>
            <p className="mt-3">
              Love Letter is written by two people. When you add a partner&apos;s name and email, you
              confirm you have their permission to invite them and to send them Service-related
              emails (such as prompts and reveal notifications). Either partner may stop
              participating at any time.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">4. Your letters</h2>
            <p className="mt-3">
              Your letters belong to you. You grant Love Letter only the limited permission needed
              to operate the Service — to store your letters, deliver them to your partner on reveal
              day, and, for Premium subscribers, to print and mail them. We do not sell your letters
              or use their contents for advertising.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">5. Premium subscription &amp; billing</h2>
            <p className="mt-3">
              Premium costs <strong>$9.99 per month, per couple</strong>, billed through our payment
              processor (Stripe). It is a recurring subscription that{" "}
              <strong>automatically renews each month</strong> on the anniversary of your start
              date, until cancelled. Each cycle&apos;s printed letters are produced and mailed after
              the writing window closes (the 5th). By subscribing, you authorize these recurring
              charges.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">6. Cancellation &amp; refunds</h2>
            <p className="mt-3">
              You can cancel your Premium subscription at any time from your dashboard
              (&quot;Manage Subscription&quot;). Your subscription renews automatically on the
              monthly anniversary of the date you subscribed. When you cancel, you keep Premium
              access through the end of the period you have already paid for, and you will not be
              charged again.
            </p>
            <p className="mt-3">
              Except where required by law, payments already made are{" "}
              <strong>non-refundable</strong>, including for partially used subscription periods.
              Cancelling stops future charges; it does not refund a charge that has already been
              made.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">7. Acceptable use</h2>
            <p className="mt-3">
              You agree not to use the Service to send unlawful, harassing, or harmful content, to
              impersonate others, or to interfere with the Service&apos;s operation. We may suspend
              or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">8. Privacy</h2>
            <p className="mt-3">
              We collect only what we need to run the Service — your account details, your letters,
              and basic delivery information. We use a third-party email provider to send Service
              emails and a payment processor to handle Premium billing. We do not sell your personal
              information.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">9. Disclaimers &amp; liability</h2>
            <p className="mt-3">
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not
              guarantee uninterrupted or error-free delivery of emails or printed letters. To the
              fullest extent permitted by law, Love Letter is not liable for indirect or
              consequential damages, and our total liability is limited to the amount you paid us in
              the twelve months before the claim.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">10. Changes to these Terms</h2>
            <p className="mt-3">
              We may update these Terms from time to time. If we make material changes, we will
              update the date above and, where appropriate, notify you. Continuing to use the
              Service after changes take effect means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-[#342d2a]">11. Contact</h2>
            <p className="mt-3">
              Questions about these Terms? Email us at{" "}
              <a
                href="mailto:hello@theloveletter.co"
                className="font-semibold text-[#c97972] underline underline-offset-2"
              >
                hello@theloveletter.co
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-[#eadbd0] pt-8 text-center">
          <Link
            href="/"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f5b58] transition hover:text-[#342d2a]"
          >
            ← Back to Love Letter
          </Link>
        </div>
      </div>
    </main>
  );
}
