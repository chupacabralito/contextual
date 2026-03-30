---
title: Checkout Friction Research
date: 2024-11-15
source: UserTesting Round 3
---

# Checkout Friction Study

## Key Findings

1. **Payment form abandonment rate: 34%** -- Users who reach the payment form but do not complete checkout.
2. The primary friction point is the card information section. Users hesitate when they see three separate fields (number, expiry, CVC) instead of a single unified input.
3. Trust badges ("SSL Encrypted", "Money-back guarantee") placed below the fold are invisible to 60% of users at the moment of hesitation.
4. Email-first ordering (asking for email before card info) increases completion by 12% because users perceive a lower commitment threshold.

## Verbatim Quotes

- "I wasn't sure if this was secure. I didn't see any lock icon near the payment button." -- P4
- "Why do they need my email first? Oh wait, that actually makes me feel like I can come back." -- P7
- "The total on the right didn't update when I expected it to. I thought something was broken." -- P11

## Recommendations

- Move trust badges above the payment form, not below
- Consider a single-line card input (Stripe Elements style)
- Add a micro-interaction confirming the total updates in real time
