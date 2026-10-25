// English versions of the written pages, translated by Flowrenix. Missing pages fall back to German with a notice.
// Legal texts (legal notice, privacy policy, terms): the German version is binding; the page shows a note.
// Keep both languages in step: every change to pages.ts needs the same change here.
import { structure, type WrittenPage, type WrittenPageHandle } from "./pages";

export const pagesEn: Partial<Record<WrittenPageHandle, WrittenPage>> = {
  impressum: structure(
    "Legal notice",
    `
**Operator of this online shop**
{{company}}
[Legal form]
{{address}}
Switzerland

**Contact**
Email: {{email}}
Phone: {{phone}}

**Authorised representative**
[First and last name, position]

**Commercial register**
[Registered in the commercial register of the canton of …, business identification number (UID) {{uid}}] or [Not registered in the commercial register]

**VAT**
[VAT number CHE-… MWST] or [Not subject to VAT]

**Liability for content and links**
We check the content of this website carefully. The operators of external websites we link to are solely responsible for their content.

**Copyright**
Texts, images, logo and design of this website belong to {{company}} or to the respective rights holders. Any use beyond private use requires our written consent.

**Design and development**
Flowrenix, flowrenix.com
`,
    "impressum",
  ),
  datenschutz: structure(
    "Privacy policy",
    `
Last updated: [Date]

### 1. Who is responsible for processing your data
The controller responsible for processing your personal data on this website and in the online shop is:
{{company}}, {{address}}, Switzerland
Email for data protection questions: [Data protection email, otherwise {{email}}]

This privacy policy is based on the Swiss Federal Act on Data Protection (FADP).

### 2. What data we process
- **Order data:** email address, first and last name, delivery address, phone number (optional), items ordered, sizes, prices, discount codes and gift cards redeemed, payment method, and the order and shipping history including the tracking number.
- **Payment data:** We do not receive card numbers or similar payment details. You enter them directly on the payment page of our payment service provider Stripe (section 4). We only see whether, when and how you paid.
- **Customer account (optional):** email address, password (stored only as an encrypted hash that we cannot read), first and last name, phone number, address, language, your orders and, if you are signed in, your wishlist.
- **Gift cards:** code, value, remaining balance and expiry date, the purchaser's email address and, if provided, the recipient's name and email address, the sender's name and the personal message.
- **Newsletter (optional):** email address, language, wording and time of your consent, time of your confirmation and of any unsubscription and, if we offer a welcome discount, your personal discount code.
- **Back-in-stock alert (optional):** email address, language, requested piece and size, and the time of your request and confirmation.
- **Communication:** your name, email address and the content and time of your messages when you contact us through the contact form, by email or by phone.
- **Technical data:** When you visit the website, technical data is generated, such as your IP address, date and time, the page you open, your browser and device. We use it to run the website and keep it secure, for example to protect the forms against misuse.
- **Data on your device:** Your browser stores your cart, your wishlist and, if you are signed in, your login (section 6).

### 3. Why we process your data
- to process orders: conclusion of the contract, payment, shipping, returns, exchanges and warranty;
- to send you emails about your order, your customer account and gift cards, for example the order confirmation and the shipping notification;
- to manage your customer account if you open one;
- to issue and redeem gift cards and keep track of the remaining balance;
- to send you the newsletter if you have subscribed and confirmed your subscription by email;
- to notify you once by email when a sold-out size is back, if you have requested this and confirmed it by email;
- to answer your questions;
- to run the website securely and reliably and to prevent misuse;
- to comply with legal obligations, in particular the retention of business records.

We do not sell your data. We only send you advertising by email if you have subscribed to the newsletter. You can unsubscribe at any time using the link in every issue.

### 4. Who we disclose data to
We work with carefully selected service providers. They only receive the data they need for their task and process it on our behalf unless stated otherwise here.

- **Website operation:** This website is run with Lovable (Lovable Labs Incorporated, USA, and Lovable Labs Sweden AB, Regeringsgatan 25, 111 53 Stockholm, Sweden) and delivered through the global network of Cloudflare, Inc. (USA). This generates the technical data described in section 2.
- **Database and customer accounts:** We store orders, customer accounts, gift cards and newsletter subscriptions in Lovable Cloud. Lovable runs the database with Supabase, Inc. (USA) in a data centre in Europe ([location]).
- **Payment:** Payments are processed by Stripe (Stripe Payments Europe, Limited, Ireland, together with Stripe, Inc., USA). Stripe processes your data for the payment on our behalf and, as an independent controller, for its own purposes, for example to prevent fraud and to comply with legal obligations. For TWINT, Apple Pay and Google Pay, the privacy policies of the respective providers and of your bank also apply. Stripe's privacy policy: https://stripe.com/ch/privacy
- **Klarna:** If you pay with Klarna, Klarna Bank AB (publ), Sveavägen 46, 111 34 Stockholm, Sweden, processes your data as an independent controller. Klarna may check your creditworthiness for this purpose, including by automated decisions. Klarna's privacy information: https://www.klarna.com/ch/en/privacy/
- **Email:** We send order confirmations, messages from the contact form and the shop's other emails through Resend (Plus Five Five, Inc., San Francisco, USA). [We send the newsletter with: newsletter service, registered office.]
- **AI search:** If you type a longer sentence into the search that the in-browser search cannot understand with confidence, we send this search text for evaluation to our "search-assist" function. It passes it on through the Lovable AI Gateway to an AI service, which translates it into search filters (for example category, colour, occasion). Operator of the AI service: [AI provider with registered office, to be confirmed by legal counsel]. The search text is only processed for this and is not stored by us. To prevent misuse we count requests per IP address, storing only a hash, not the address itself (section 7). Your browser remembers the result until the tab is closed (section 6). The service may operate outside Switzerland (section 5). Please avoid entering personal data into the search.
- **Shipping:** For delivery, we pass your name, delivery address and shipment data to Swiss Post (Post CH Ltd, Post CH Network Ltd and Swiss Post Ltd, Wankdorfallee 4, 3030 Bern). Swiss Post processes this data as an independent controller, according to its own information in Switzerland, Liechtenstein and Germany. Swiss Post's data protection information: https://www.post.ch/en/pages/footer/data-protection-and-disclaimer
- **Technical support:** Flowrenix, Gibswil (Switzerland), runs and maintains the shop on our behalf and may access the data where necessary.
- **Authorities:** where we are legally obliged to do so.

### 5. Disclosure abroad
Some of the service providers listed process data outside Switzerland. The Federal Council has found that the countries of the EU and the EEA (for example Ireland, Sweden and Germany) provide adequate data protection. We disclose data to the USA to companies certified under the Swiss-U.S. Data Privacy Framework or on the basis of standard contractual clauses recognised by Switzerland.

### 6. Cookies and storage in your browser
We only use what is needed to run the shop:
- **Cart and wishlist** in your browser's local storage (entries \`axion-cart\` and \`axion-wishlist\`). You can delete them in your browser settings at any time.
- **Recently viewed items** in local storage (entry \`axion-recent\`) and **recent searches** (entry \`axion-recent-searches\`, the last five search terms). Both stay on your device and are not sent to us.
- **AI search cache** in session storage (entry \`axion-search-assist\`): the answer to a longer search text, so the same question is not asked again. It is deleted when you close the tab.
- **Language:** The chosen language is part of the page address (for example \`/en\`); the shop does not store it separately.
- **Login:** When you sign in to your customer account, your browser stores a login key until you sign out.
- **Cloudflare** sets a cookie (\`__cf_bm\`) that fends off automated attacks and expires after 30 minutes of inactivity.
- **Payment page:** On its payment page, Stripe sets its own cookies, among other things to prevent fraud. Details are in Stripe's privacy policy.

We do not use analytics or advertising cookies on this website. Our emails and the newsletter contain no open or click tracking. You can delete cookies and your browser storage at any time. Without the necessary cookies, however, you cannot complete a purchase.

### 7. How long we keep data
We keep personal data for as long as we need it for the purposes described:
- **Orders and receipts:** ten years, as the law requires for business records.
- **Customer account:** until you delete it. You can do this yourself in your customer account at any time. We then keep your orders, no longer linked to the account, for the statutory period.
- **Newsletter:** until you unsubscribe. We keep the record of your consent and unsubscription for as long as we need it as evidence.
- **Back-in-stock alert:** we delete your address once the alert has been sent; unconfirmed requests after 30 days.
- **Gift cards:** until they expire and then for the statutory period for business records.
- **Messages sent through the contact form:** The shop does not store them; they reach our mailbox as emails. We keep them for as long as we need them for your enquiry.
- **Protection against misuse:** To stop anyone from using the forms, checkout or gift card check on a massive scale, we count requests per IP address and email address. For this, we store only a hash of the address, not the address itself, together with the count and the time. We delete expired counters on an ongoing basis, usually after two days.

### 8. Data security
We protect your data with appropriate technical and organisational measures. The connection to our website is encrypted, we store passwords only as an encrypted hash, and only we and our service providers have access to the data, to the extent necessary.

### 9. Your rights
At any time, you can:
- ask whether we process data about you and which data;
- ask us to correct inaccurate data;
- ask us to delete your data or to stop processing it, unless a legal obligation or an overriding interest prevents this;
- ask us to hand over or transfer your data in a common electronic format;
- withdraw consent you have given, for example for the newsletter, with effect for the future.

To do so, write to us at {{email}}. We may ask for proof of identity. You can also lodge a complaint with the Federal Data Protection and Information Commissioner (FDPIC): www.edoeb.admin.ch

### 10. Changes
We may update this privacy policy. The version published on this website applies.
`,
  ),
  agb: structure(
    "General terms and conditions",
    `
Last updated: [Date]

### 1. Scope
These terms and conditions apply to all orders and to the purchase of gift cards in the {{brand}} online shop at [domain]. Your contractual partner is {{company}}, {{address}}, Switzerland, email {{email}} ("we"). We only deliver to addresses in Switzerland [and Liechtenstein].

### 2. Order and conclusion of the contract
The presentation of the products in the shop is not a binding offer. This is how you order:
1. Choose a size and add the item to your cart.
2. Enter your email address in the cart and, if you have one, redeem a discount code or gift card.
3. Click "Checkout". You are taken to the payment page of our payment service provider Stripe.
4. Enter your delivery address and choose a payment method.
5. Check all details and correct them if necessary.
6. Submit your binding order with the payment button.

Until you submit your order, you can change all entries or cancel the purchase. While you pay, we reserve the items for a short time. After successful payment, you receive an order confirmation by email. The contract is concluded with this confirmation. If an item is no longer available despite the confirmation, we inform you immediately and refund any amounts already paid without delay.

You can order as a guest or open a customer account. [If you are under 18, you need the consent of your parents or legal guardian to place an order.] or [You can order from the age of 16; until you are 18, you need the consent of your parents or legal guardian.]

### 3. Prices
All prices are final prices in Swiss francs (CHF). [If subject to VAT: They include statutory VAT.] Any shipping costs are shown in the cart and on the payment page before you order. The price shown in the shop at the time of your order applies.

### 4. Payment, discount codes and gift cards
You can pay with TWINT, credit or debit card (Visa, Mastercard, American Express), Apple Pay, Google Pay or Klarna. Which payment methods appear depends, among other things, on your device and the amount. Payment is triggered when you order and processed by Stripe. If you pay with Klarna, Klarna's terms and payment periods also apply. We do not offer purchase on invoice ourselves.

You can redeem one discount code and one gift card per order. Discounts apply to the value of the goods, not to shipping costs and not to the purchase of gift cards. Discount codes are only valid under the stated conditions and cannot be paid out in cash.

### 5. Delivery
We deliver with Swiss Post. Delivery usually takes 2 to 5 working days after receipt of payment. As soon as your parcel is on its way, you receive a shipping notification with a tracking number. Partial deliveries are possible at no extra cost to you. We bear the risk of loss and damage in transit until the goods are handed over to you.

### 6. Gift cards
- You receive the gift card by email with a personal code. On request, we send it directly to the recipient.
- The gift card is valid from purchase for the period stated on it ([5 years]). You can check the remaining balance in the shop at any time.
- You can redeem the gift card across several orders until the balance is used up. It cannot be paid out in cash. You cannot buy gift cards with discount codes or other gift cards.
- Anyone who knows the code can redeem it, so keep it safe. If a code has been lost, contact us immediately: as long as the balance has not been redeemed, we block the code and transfer the remaining balance to a new one.
- Gift cards are excluded from the voluntary right of return. If you return goods that you paid for in full or in part with a gift card, we refund that part as a gift card.

### 7. Voluntary right of return
Swiss law does not provide for a right of return for online purchases. We voluntarily grant you a right of return of {{returnDays}} days from receipt of the goods.
- **Conditions:** The goods are unworn, unwashed, unaltered and complete, with all tags and, if possible, in the original packaging. [Excluded are: …]
- **How to return:** Notify us of the return by email to {{email}}, stating your order number. [Return label: enclosed with the parcel / we send it to you by email / you pay the postage yourself.]
- **Costs:** [Returns are free for you.] or [You bear the return costs of CHF ….]
- **Refund:** After we have received and checked the goods, we refund the purchase price within [number] days to the original payment method [or as a gift card, as you choose].
- **Exchange:** You can exchange an item for another size [free of charge] while it is available.

[Only for delivery to Liechtenstein: Consumers resident in Liechtenstein also have the statutory right of withdrawal from distance contracts under Liechtenstein law. Consult a specialist.]

### 8. Warranty
The statutory provisions apply. The warranty period is two years from delivery. Please check the goods when you receive them and notify us of any defects by email to {{email}} as soon as you discover them. In the event of a defect, you can by law demand cancellation of the purchase, a price reduction or a replacement free of defects. We are also happy to offer you a repair if that suits you. Normal wear and tear and damage caused by improper care are not defects.

### 9. Customer account and newsletter
The customer account is optional. Keep your password secret. You can delete your account yourself in your customer account at any time. You only receive the newsletter if you have subscribed and confirmed your subscription by email. You can unsubscribe at any time using the link in every issue.

### 10. Liability
We are liable in accordance with the statutory provisions. We are not liable for slight negligence to the extent permitted by law. Liability for damage caused intentionally or through gross negligence and for personal injury remains unaffected.

### 11. Data protection
How we process your data is described in our privacy policy.

### 12. Applicable law and place of jurisdiction
Swiss law applies, excluding the UN Convention on Contracts for the International Sale of Goods (CISG). The statutory places of jurisdiction apply to disputes. As a consumer, you can take legal action at your place of residence or at our registered office. [Only for delivery to Liechtenstein: For consumers resident in Liechtenstein, the mandatory provisions of the law of their place of residence remain reserved.]

### 13. Changes
We may change these terms and conditions at any time. Your order is governed by the version published at the time of your order.
`,
  ),
  "versand-und-rueckgabe": structure(
    "Shipping and returns",
    `
- **Delivery area:** Switzerland [and Liechtenstein]
- **Shipping:** with Swiss Post. {{shipping}}
- **Delivery time:** 2 to 5 working days after payment, tracking number by email
- **Returns:** within {{returnDays}} days of receipt, unworn and with all tags
- **Return shipping:** [free / CHF …], [label included / on request]
- **Refund:** within [number] days of receiving your return, to the original payment method
- **Exchange:** another size [free of charge], while available
- **Gift cards:** excluded from returns
- **Defects:** two-year statutory warranty, report by email to {{email}}
The binding rules are set out in the terms and conditions; the German version is legally binding.
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
They are the usual European sizes for suits, jackets, waistcoats, coats and trousers. Shirts come in collar sizes (38 to 45), knitwear from S to XXL and shoes in EU sizes.
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
{{shipping}}. You see the exact amount in your cart before you order.
**Does Axion ship abroad?**
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
