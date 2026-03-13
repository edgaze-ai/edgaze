"use client";

import React from "react";
import { motion } from "framer-motion";

const FAQ_ITEMS = [
  {
    q: "Do I need a big audience already?",
    a: "No. Edgaze creators range from solo operators to teams. What matters is building workflows people want to run.",
  },
  {
    q: "Can I join before publishing anything?",
    a: "Yes. Set up your profile and payout onboarding first. Publish when you're ready.",
  },
  {
    q: "Why do I need payout onboarding?",
    a: "To receive payments when you sell workflows. We use Stripe Connect for secure, compliant payouts.",
  },
  {
    q: "What kinds of creators is this for?",
    a: "Prompt creators, workflow builders, automation operators, educators, consultants, and AI power users.",
  },
  {
    q: "Do I need to be technical?",
    a: "Some familiarity helps, but our visual builder and Prompt Studio make it accessible. You can start with prompts and evolve to workflows.",
  },
];

export default function CreatorFaq() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Creator notes
          </h2>
          <p className="mt-4 text-lg text-white/60">
            Common questions and answers.
          </p>
        </motion.div>

        <div className="space-y-4">
          {FAQ_ITEMS.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <h3 className="text-base font-semibold text-white">{faq.q}</h3>
              <p className="mt-2 text-sm text-white/60 leading-relaxed">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
