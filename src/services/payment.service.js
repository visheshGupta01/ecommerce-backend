import crypto from "crypto";
import razorpay from "../config/razorpay.js";

export const verifySignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return expectedSignature === razorpaySignature;
};

export const verifyWebhookSignature = (body, signature) => {
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
};

export const createRazorpayOrder = async ({ amount, receipt }) => {
  return razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    receipt,
  });
};

export const fetchPaymentDetails = async ({
  razorpayOrderId,
  razorpayPaymentId,
}) => {
  const [order, payment] = await Promise.all([
    razorpay.orders.fetch(razorpayOrderId),
    razorpay.payments.fetch(razorpayPaymentId),
  ]);

  return {
    order,
    payment,
  };
};

export const verifyRazorpayPayment = async ({
  razorpayOrderId,
  razorpayPaymentId,
  expectedAmount,
}) => {
  const { order, payment } = await fetchPaymentDetails({
    razorpayOrderId,
    razorpayPaymentId,
  });

  if (order.amount !== Math.round(expectedAmount * 100)) {
    throw new Error("Amount mismatch");
  }

  if (!["captured", "authorized"].includes(payment.status)) {
    throw new Error(`Unexpected payment status: ${payment.status}`);
  }

  return payment;
};
