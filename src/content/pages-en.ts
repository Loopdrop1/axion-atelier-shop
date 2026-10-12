// English versions of the written pages. Missing pages fall back to German with a notice
// (legal texts: the German version is binding; the client supplies English legal texts).
import { structure, type WrittenPage, type WrittenPageHandle } from "./pages";

export const pagesEn: Partial<Record<WrittenPageHandle, WrittenPage>> = {
  "versand-und-rueckgabe": structure(
    "Shipping and returns",
    `
- **Delivery area:** Switzerland [and Liechtenstein]
- **Shipping:** with Swiss Post, you see the cost in your cart
- **Delivery time:** 2 to 5 working days after payment, tracking number by email
- **Returns:** within {{returnDays}} days of receipt, unworn and with all tags
- **Return shipping:** [free / CHF …], [label included / on request]
- **Refund:** within [number] days of receiving your return, to the original payment method
- **Exchange:** another size [free of charge], while available
- **Gift cards:** excluded from returns
- **Defects:** two-year statutory warranty, report by email to {{email}}
The binding rules are set out in the terms and conditions (German version).
`,
    "definitions",
  ),
  "haeufige-fragen": structure(
    "Frequently asked questions",
    `
### Sizes
**Which size fits me?**
Measure your chest and waist and compare the values with our size chart. If you are unsure, email us at {{email}}.
**What do the numbers 46 to 56 mean?**
They are the usual European sizes for suits and waistcoats. Shoes come in EU sizes.
**Can I exchange an item for another size?**
Yes, within {{returnDays}} days, while the size is available. Email us at {{email}}.

### Orders and account
**Do I need an account?**
No, you can order as a guest. With an account you see all your orders and their shipping status in one place.
**Where is my parcel?**
As soon as your parcel is on its way, you get a shipping email with the Swiss Post tracking number. With an account you also find it there.
**Can I still change my order?**
Email us as soon as possible at {{email}}. As long as the parcel has not been shipped, we can usually find a solution.

### Delivery
**How long does delivery take?**
Usually 2 to 5 working days after payment.
**How much is shipping?**
You see the shipping cost in your cart before you order.
**Do you ship abroad?**
At the moment we only ship within Switzerland [and to Liechtenstein].

### Returns
**Can I return an item?**
Yes. You can return items within {{returnDays}} days of receipt, unworn and with all tags. The details are in the terms and conditions.
**When do I get my money back?**
Within [number] days of receiving your return, to the original payment method.

### Payment, gift cards and discount codes
**How can I pay?**
With TWINT, credit or debit card, Apple Pay, Google Pay or Klarna.
**Can I pay by invoice?**
With Klarna you can pay later or in instalments, subject to approval by Klarna. We do not offer our own invoice payment.
**How do I redeem a gift card or discount code?**
Enter the code in your cart before you go to checkout. You can use one discount code and one gift card per order.
**How long is a gift card valid?**
As long as stated on the gift card. You can check the remaining balance at any time on the gift card page.
**Can I send a gift card directly?**
Yes. Enter the recipient's name and email address when you buy it, and we send the gift card straight to them.

### Newsletter
**How do I unsubscribe from the newsletter?**
Use the link at the end of every newsletter email. Unsubscribing takes effect immediately.

### Care
**How do I care for my suit?**
Hang the suit on a wide hanger after wearing and let it air. Clean it only when necessary and always follow the care label.
**How do I care for leather shoes?**
Use shoe trees, let the shoes rest for a day after wearing, and polish them regularly with a suitable shoe cream.
`,
    "questions",
  ),
};
