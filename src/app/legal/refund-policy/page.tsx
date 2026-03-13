export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Refund Policy
          </span>
        </h1>

        <div className="prose prose-invert max-w-none space-y-6 text-white/80">
          <p className="text-sm text-white/60">Last Updated: February 27, 2026</p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Our Commitment</h2>
            <p>
              At Edgaze, we want you to be satisfied with your purchases. This Refund Policy explains 
              when and how you can request a refund for workflows and prompts purchased on our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7-Day Refund Window</h2>
            <p>
              You may request a refund within <strong>7 days</strong> of purchase if:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The workflow or prompt does not function as described</li>
              <li>You encounter technical issues that prevent usage</li>
              <li>The content significantly differs from its description</li>
              <li>The product contains errors that make it unusable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Non-Refundable Situations</h2>
            <p>
              Refunds will <strong>not</strong> be issued if:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>More than 7 days have passed since purchase</li>
              <li>You simply changed your mind after using the product</li>
              <li>You did not read the product description before purchasing</li>
              <li>You lack the technical knowledge to use the product (unless it was misrepresented as beginner-friendly)</li>
              <li>You violate our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">How to Request a Refund</h2>
            <p>
              To request a refund:
            </p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Contact our support team at <a href="mailto:support@edgaze.ai" className="text-cyan-400 hover:underline">support@edgaze.ai</a></li>
              <li>Include your purchase receipt or transaction ID</li>
              <li>Explain the reason for your refund request</li>
              <li>Provide screenshots or details of any technical issues</li>
            </ol>
            <p className="mt-4">
              We aim to respond to all refund requests within 2 business days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Refund Processing</h2>
            <p>
              If your refund is approved:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Full refunds are issued to your original payment method</li>
              <li>Processing typically takes 5-10 business days</li>
              <li>Your access to the purchased content will be revoked</li>
              <li>The creator&apos;s earnings will be adjusted accordingly</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Partial Refunds</h2>
            <p>
              In some cases, we may offer a partial refund:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>If you&apos;ve used the product extensively but encountered issues</li>
              <li>If only part of a bundle is defective</li>
              <li>At our discretion for exceptional circumstances</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Chargebacks</h2>
            <p>
              <strong>Please contact us before initiating a chargeback.</strong>
            </p>
            <p>
              Chargebacks should be a last resort. If you file a chargeback without contacting us first:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your account may be suspended pending investigation</li>
              <li>You may be banned from future purchases</li>
              <li>We will dispute fraudulent chargebacks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Creator Responsibilities</h2>
            <p>
              Creators are expected to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Accurately describe their products</li>
              <li>Ensure products function as advertised</li>
              <li>Provide reasonable support to buyers</li>
              <li>Update products to fix critical bugs</li>
            </ul>
            <p className="mt-4">
              Excessive refund rates may result in creator account review.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Exceptions</h2>
            <p>
              We reserve the right to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Issue refunds outside the 7-day window for exceptional cases</li>
              <li>Deny refunds for abuse of the refund system</li>
              <li>Update this policy with 30 days notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact Us</h2>
            <p>
              Questions about our refund policy? Contact us at{' '}
              <a href="mailto:support@edgaze.ai" className="text-cyan-400 hover:underline">
                support@edgaze.ai
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
