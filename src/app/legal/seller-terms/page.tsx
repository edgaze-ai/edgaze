export default function SellerTermsPage() {
  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Seller Terms of Service
          </span>
        </h1>

        <div className="prose prose-invert max-w-none space-y-6 text-white/80">
          <p className="text-sm text-white/60">Last Updated: February 27, 2026</p>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Agreement to Terms</h2>
            <p>
              By creating a Stripe Connect account and selling products on Edgaze, you agree to these Seller Terms, 
              our general Terms of Service, Privacy Policy, and Stripe's Connected Account Agreement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Eligibility</h2>
            <p>To sell on Edgaze, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be at least 18 years old</li>
              <li>Have the legal capacity to enter into binding contracts</li>
              <li>Provide accurate information during Stripe onboarding</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Not be located in a country where Stripe is unavailable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Revenue Share</h2>
            <p>
              Edgaze operates on an 80/20 revenue split model:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>You receive:</strong> 80% of each sale</li>
              <li><strong>Platform fee:</strong> 20% to cover hosting, payment processing, and platform operations</li>
              <li>Stripe payment processing fees (2.9% + $0.30) are deducted before the split</li>
              <li>All amounts are calculated and displayed in USD</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Payouts</h2>
            <p>
              Payouts are handled automatically by Stripe:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Automatic weekly payouts every Monday</li>
              <li>Minimum payout threshold: $10.00</li>
              <li>Payouts typically arrive in 2-3 business days</li>
              <li>You can view payout history in your Stripe Express Dashboard</li>
              <li>Failed payouts will be automatically retried</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Content Requirements</h2>
            <p>All products you sell must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be your original work or properly licensed</li>
              <li>Not infringe on any intellectual property rights</li>
              <li>Comply with our Content Policy</li>
              <li>Function as described</li>
              <li>Not contain malicious code or harmful content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Refunds and Chargebacks</h2>
            <p>
              <strong>Refunds:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Buyers may request refunds within 7 days of purchase</li>
              <li>Refunds are issued at Edgaze's discretion</li>
              <li>Your earnings will be adjusted for any refunds</li>
              <li>If a refund occurs after payout, it will be deducted from future earnings</li>
            </ul>
            <p className="mt-4">
              <strong>Chargebacks:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are responsible for chargebacks on your products</li>
              <li>Chargeback amounts will be deducted from your balance</li>
              <li>Excessive chargebacks may result in account suspension</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Taxes</h2>
            <p>
              You are responsible for all taxes related to your earnings:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Stripe will issue 1099-K forms for US creators earning over $600/year</li>
              <li>International creators must provide W-8BEN forms</li>
              <li>You must report all earnings to relevant tax authorities</li>
              <li>Edgaze is not responsible for your tax obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Account Suspension</h2>
            <p>
              We may suspend or terminate your seller account if:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You violate these terms or our policies</li>
              <li>You engage in fraudulent activity</li>
              <li>You receive excessive chargebacks or disputes</li>
              <li>Your Stripe account is restricted or closed</li>
              <li>Required by law or payment processor</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
            <p>
              Edgaze is not liable for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Lost earnings due to technical issues</li>
              <li>Stripe payout delays or failures</li>
              <li>Buyer disputes or chargebacks</li>
              <li>Changes to revenue share or payout terms (with 30 days notice)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
            <p>
              We may update these terms at any time. Continued selling after changes constitutes acceptance. 
              Material changes will be communicated via email with 30 days notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact</h2>
            <p>
              For questions about these Seller Terms, contact us at{' '}
              <a href="mailto:sellers@edgaze.ai" className="text-cyan-400 hover:underline">
                sellers@edgaze.ai
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
