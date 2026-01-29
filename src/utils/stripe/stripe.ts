import { Types } from "mongoose";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-12-15.clover",
});

export const createPayment = async (
  amount: number,
  userId?: Types.ObjectId,
) => {
  try {
    if (amount <= 0) throw new Error("Amount must be greater than zero");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Donation",
              description: "Thank you for your support!",
            },

            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",

      success_url: `${process.env.NEXT_PUBLIC_CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_CLIENT_URL}/cancel`,

      metadata: {
        userId: userId ? userId.toString() : "anonymous",
      },
    });

    return session;
  } catch (error: any) {
    console.error("Stripe Session Error:", error.message);
    throw new Error(`Payment failed: ${error.message}`);
  }
};
