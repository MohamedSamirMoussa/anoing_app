import { Types } from "mongoose";
import Stripe from "stripe";

// 1. تهيئة Stripe خارج الدالة لتحسين الأداء (Singleton Pattern)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-01-27", // تأكد من استخدام أحدث إصدار
});

export const createPayment = async (amount: number, userId?: Types.ObjectId) => {
  try {
    // 2. التحقق من صحة المبلغ لمنع أخطاء Stripe (يجب أن يكون أكبر من 0.50 دولار عادةً)
    if (amount <= 0) throw new Error("Amount must be greater than zero");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Donation",
              description: "Thank you for your support!", // إضافة وصف يعطي انطباعاً أفضل
            },
            // تحويل المبلغ إلى أصغر وحدة عملة (Cents)
            unit_amount: Math.round(amount * 100), 
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // 3. استخدام متغيرات البيئة للـ URLs بدلاً من hardcoded localhost
      success_url: `${process.env.NEXT_PUBLIC_CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_CLIENT_URL}/cancel`,
      
      // 4. حماية الـ Metadata (التحقق من وجود userId قبل تحويله لـ string)
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