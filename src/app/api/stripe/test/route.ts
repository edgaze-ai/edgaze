import { stripe } from "../../../../lib/stripe"

export async function GET() {
  const balance = await stripe.balance.retrieve()

  return Response.json({
    success: true,
    balance
  })
}
