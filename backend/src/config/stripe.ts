import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
  throw new Error('STRIPE_SECRET_KEY environment variable is missing.');
}

export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2023-10-16' as any,
});
