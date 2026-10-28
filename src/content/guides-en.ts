// Guides (English). Same structure as guides.ts (German is binding); a test keeps both in step.
import type { Guide } from "./guides";
import type { GuideSlug } from "./guides-meta";

export const guidesEn: Record<GuideSlug, Guide> = {
  "anzug-hochzeit": {
    intro:
      "A wedding is an occasion where you are seen but should not be the centre of attention. As a guest you choose a suit that suits the dress code, the time of day and the season. As the groom you wear it for a whole day, from the vows to the last dance. This guide helps with both roles.",
    sections: [
      {
        heading: "Clarify the dress code first",
        blocks: [
          {
            type: "paragraph",
            text: "Read the invitation carefully. If it says «festive» or «cocktail», a dark suit with a tie is right. «Black tie» calls for a tuxedo or at least a very dark, plain suit with a bow tie; you will find more under [the Gala occasion](/kollektion/alle?anlass=gala). If there is no instruction, go by place and time of day: a civil ceremony in the morning followed by an apéro can be a little lighter than an evening reception in a hotel.",
          },
          {
            type: "paragraph",
            text: "When in doubt: better one step more formal than one step too casual. You can take your jacket off in the evening, but a missing tie cannot be added later. If you are unsure, ask the couple or the witnesses.",
          },
        ],
      },
      {
        heading: "Colours by season",
        blocks: [
          {
            type: "paragraph",
            text: "The season decides colour and fabric weight. As a rule of thumb: the lighter and warmer the day, the lighter the suit; the colder it is, the darker and denser.",
          },
          {
            type: "bullets",
            items: [
              "**Spring and summer:** light grey, mid blue or sand look fresh. Lighter fabrics are more comfortable in the heat, especially at an outdoor celebration.",
              "**Autumn:** charcoal, navy and muted earth tones suit falling leaves and candlelight. A tie in burgundy or forest green adds a quiet accent.",
              "**Winter:** dark navy and charcoal are the first choice. A three-piece suit with a waistcoat keeps you warm, and you can add a coat over it if needed.",
            ],
          },
          {
            type: "paragraph",
            text: "Avoid white and cream, which traditionally belong to the bride. An all-black suit strikes many people as severe during the day; in the evening it works well. Navy and charcoal work almost every time. You will find a selection in the [suits](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "As the groom: a suit for the whole day",
        blocks: [
          {
            type: "paragraph",
            text: "You will sit, stand, hug and dance in this suit. So look for freedom of movement at the shoulders and arms, and a fabric that does not crease easily. A three-piece suit with a [waistcoat](/kollektion/westen) looks more festive, and you can simply take the waistcoat off in the heat of the evening. Agree colour and style with the bride so that you go together in the photos without looking identical.",
          },
          {
            type: "paragraph",
            text: "Order the suit early and try it on at home in peace, with the shoes and shirt you plan to wear. That leaves enough time if you need a different size. How this works is explained under [Shipping and returns](/versand-und-rueckgabe). The [size guide](/groessenberatung) explains how to find the right size.",
          },
        ],
      },
      {
        heading: "Shirt and tie or bow tie",
        blocks: [
          {
            type: "paragraph",
            text: "A white or light blue [shirt](/kollektion/hemden) with a firm collar is the safe choice. The tie can show a little more colour as long as it goes with the suit: burgundy, green or silver grey look good with navy. A bow tie looks more festive and suits the evening in particular. A [pocket square](/kollektion/accessoires) in a shade of the tie, but not in the identical pattern, completes the picture.",
          },
        ],
      },
      {
        heading: "Shoes, belt and accessories",
        blocks: [
          {
            type: "paragraph",
            text: "For [shoes](/kollektion/schuhe), Oxfords and Derbies in smooth leather are the classic choice. Black goes with charcoal, grey and, in the evening, with anything dark. Dark brown works with navy and mid grey during the day but is slightly less formal. Belt and shoes should be the same shade, and socks the colour of the trousers or a little darker, so that no bare skin shows when you sit down.",
          },
          {
            type: "paragraph",
            text: "With a watch, cufflinks and tie pin, less is more. One well-chosen piece is enough. Polish your shoes the evening before, brush the suit and hang it up so that it is smooth in the morning.",
          },
        ],
      },
    ],
    summary: [
      "Clarify dress code and time of day first; when in doubt, dress slightly more formally.",
      "Navy and charcoal suit every season, lighter shades work better in summer.",
      "Avoid white and cream; all black is better kept for the evening.",
      "As the groom, order early, try it on in peace and look for freedom of movement.",
      "Shoes and belt in the same shade, accessories understated.",
    ],
    faq: [
      {
        question: "Can I wear a black suit as a guest?",
        answer:
          "Yes, in the evening a black suit works well, especially with a festive dress code. During the day navy or charcoal usually looks softer. What matters is that the suit stays plain and that you lift it with a light shirt and a coloured tie.",
      },
      {
        question: "Tie or bow tie at a wedding?",
        answer:
          "Both are possible. The tie suits almost any dress code. The bow tie looks more festive and is the right choice for «black tie». Wear it only if you feel comfortable in it.",
      },
      {
        question: "Do brown shoes go with a navy suit?",
        answer:
          "Yes, dark brown smooth-leather shoes go well with navy and mid grey during the day. In the evening and with a strict dress code, black shoes are the more formal choice.",
      },
      {
        question: "How early should I order the wedding suit?",
        answer:
          "Allow a few weeks of buffer before the celebration. That way you can try the suit on without time pressure and order another size if needed.",
      },
    ],
    related: [
      { label: "Suits", path: "/kollektion/anzuege" },
      { label: "Wedding occasion", path: "/kollektion/alle?anlass=hochzeit" },
      { label: "Shirts", path: "/kollektion/hemden" },
      { label: "Shoes", path: "/kollektion/schuhe" },
      { label: "Accessories", path: "/kollektion/accessoires" },
      { label: "Size guide", path: "/groessenberatung" },
    ],
  },

  "slim-fit-oder-regular-fit": {
    intro:
      "When buying a suit, the choice is often between slim fit and regular fit. Both cuts are good, but they do not suit every body equally. What matters is that the suit fits at the shoulders and that you can move in it. This guide explains the differences and shows how to tell that a suit fits properly.",
    sections: [
      {
        heading: "What separates slim fit from regular fit",
        blocks: [
          {
            type: "paragraph",
            text: "A slim fit is cut closer to the body: the waist is more defined, and sleeves and trouser legs are narrower. A regular fit leaves more room at the chest, stomach and thighs and falls straighter. The difference shows mainly in the upper body and the trouser leg, not in the shoulder, which has to fit equally well in both cuts.",
          },
          {
            type: "paragraph",
            text: "The fit of each piece is given in the shop under «Fit» in the product details. You will find an overview in the [suits](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "Which cut suits which build?",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Slim or athletic upper body:** slim fit follows the line and looks calm without extra fabric. On a very narrow build it stops the jacket from standing away at the sides.",
              "**Strong thighs or shoulders:** regular fit leaves more room to move. A cut that is too tight pulls creases across the back or thighs.",
              "**Rounder stomach:** regular fit usually sits more comfortably. What matters is that the button closes without strain when you stand.",
              "**Lots of movement in daily life:** if you wear the suit for long stretches, for example at the office or at a celebration, a little more room serves you better.",
            ],
          },
          {
            type: "paragraph",
            text: "This is a guide, not a rule. If in doubt, try both cuts. Returns exist for exactly this; the conditions are set out under [Shipping and returns](/versand-und-rueckgabe).",
          },
        ],
      },
      {
        heading: "Finding the right size",
        blocks: [
          {
            type: "paragraph",
            text: "Size comes before cut. Measure chest, waist and hips with a tape measure over a shirt and compare the values with the table in the [size guide](/groessenberatung). If your chest measurement falls between two sizes, take the larger one if you wear the suit over a shirt and occasionally over a thin knit, and the smaller one if you want a very close look.",
          },
          {
            type: "paragraph",
            text: "Jacket and trousers do not have to be the same size. Where suits are sold as a set, check the product details for the available sizes and read the notes on fit. For a combination of [jacket](/kollektion/sakkos) and [trousers](/kollektion/hosen) you choose each piece separately.",
          },
        ],
      },
      {
        heading: "How to tell that a suit fits properly",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Shoulders:** the seam sits exactly at the shoulder bone. If it sticks out or slips over the shoulder, the jacket is too big or too small.",
              "**Chest and button:** the fastened button does not pull X-shaped creases. You can lay your hand flat between jacket and shirt.",
              "**Collar:** the jacket collar rests against the shirt collar without standing away.",
              "**Sleeves:** the jacket ends around the wrist so that one to one and a half centimetres of shirt cuff show.",
              "**Length:** the jacket usually covers the seat. With your arms hanging loosely, your fingertips reach about the bottom hem.",
              "**Trousers:** the waistband sits on the waist without needing a belt, nothing presses when you sit, and the fabric falls straight without horizontal creases.",
            ],
          },
          {
            type: "paragraph",
            text: "Move when you try it on: raise your arms, reach forward, sit down. A good suit does not restrict you.",
          },
        ],
      },
      {
        heading: "Between two cuts: how to decide",
        blocks: [
          {
            type: "paragraph",
            text: "Ask yourself where you will wear the suit. For long days at the office, a cut with some room to move is worth it. For evenings and shorter occasions it can sit closer. If the slim fit suits you at the shoulders and chest but not at the thighs, the regular fit is often the better solution for the trousers. In the end what counts is not the label but how you feel in the mirror and in motion.",
          },
        ],
      },
    ],
    summary: [
      "Slim fit sits close to the body, regular fit gives more room at chest, stomach and thighs.",
      "Determine the size first, then choose the cut.",
      "Shoulder seam, collar, sleeve length and button show whether the jacket fits.",
      "Move when trying it on: raise your arms, sit down, reach forward.",
      "If in doubt, try both cuts and keep the more comfortable one.",
    ],
    faq: [
      {
        question: "Is slim fit only for slim men?",
        answer:
          "Not exclusively, but it needs room at the chest and thighs that a stronger build often does not leave. What matters is that shoulders and button sit without strain. If they do not, regular fit is the better choice.",
      },
      {
        question: "Which size do I take if I fall between two?",
        answer:
          "Go by chest measurement and shoulders, because neither can be hidden. If you also want to wear the suit over a jumper, take the larger size. The table in the size guide helps with the comparison.",
      },
      {
        question: "How long should suit trousers be?",
        answer:
          "The trousers should rest lightly on the shoe at the front or end just above it without bunching. Check the product details and the size table, and wear the shoes you plan to wear with the suit when trying them on.",
      },
      {
        question: "Can I return a suit if it does not fit?",
        answer:
          "Yes, within the return period. The conditions are set out under «Shipping and returns». Try the suit on as soon as possible after it arrives.",
      },
    ],
    related: [
      { label: "Suits", path: "/kollektion/anzuege" },
      { label: "Jackets", path: "/kollektion/sakkos" },
      { label: "Trousers", path: "/kollektion/hosen" },
      { label: "Size guide", path: "/groessenberatung" },
      { label: "Frequently asked questions", path: "/haeufige-fragen" },
    ],
  },

  "business-dresscode-schweiz": {
    intro:
      "How people dress at work in Switzerland depends strongly on the industry, the company and the amount of client contact. A bank or law firm follows different rules from an agency or a technology company. This guide explains the two common levels, business formal and business casual, and shows how to combine colours, shirts and ties.",
    sections: [
      {
        heading: "Business formal: the classic look",
        blocks: [
          {
            type: "paragraph",
            text: "Business formal means a suit in one fabric, a shirt with a firm collar, a tie and closed leather shoes. It is the standard for client visits at banks, insurers, consultancies and law firms, for negotiations and for interviews in conservative industries. Colours are calm: navy, charcoal and mid grey. For patterns, fine pinstripes or a subtle herringbone work as long as they do not dominate.",
          },
          {
            type: "paragraph",
            text: "For the shirt, white is the safest choice and light blue the second. Choose the tie a little darker than the shirt. Shoes are black with charcoal and grey, dark brown with navy; the belt matches the shoes. You will find a selection under [the Business occasion](/kollektion/alle?anlass=business).",
          },
        ],
      },
      {
        heading: "Business casual: more relaxed, but polished",
        blocks: [
          {
            type: "paragraph",
            text: "Business casual drops at least one element of the formal look. That can be a jacket in a different colour from the trousers, a shirt without a tie, or a fine jumper instead of the jacket. What still matters is that everything is clean, pressed and well cut. Dark blue jeans without rips are possible in some companies, trainers only if the company culture clearly allows it.",
          },
          {
            type: "bullets",
            items: [
              "**Jacket and trousers separately:** a navy [jacket](/kollektion/sakkos) goes with grey or beige [trousers](/kollektion/hosen).",
              "**Shirt without a tie:** the top button stays open, and the collar stays firm and does not collapse.",
              "**Knitwear instead of a jacket:** a thin V-neck jumper over a shirt looks tidy; find more under [knitwear](/kollektion/strick).",
              "**Shoes:** leather Derbies or loafers rather than trainers.",
            ],
          },
        ],
      },
      {
        heading: "How to choose the level",
        blocks: [
          {
            type: "paragraph",
            text: "Watch what colleagues wear, and look at what job adverts or the company website show. For an interview, dress one level more formally than is usual day to day. Someone who works without a tie at their company still arrives at the interview in a jacket and a smart shirt. Client visits follow the client: when in doubt, dress formally and hang the jacket over the chair if needed.",
          },
        ],
      },
      {
        heading: "Colours and combinations",
        blocks: [
          {
            type: "paragraph",
            text: "Navy is the most versatile office shade and combines with white, light blue and fine stripes. Charcoal looks a little stricter and suits important meetings. Mid grey is lighter and pleasant in summer. Brown and olive tones belong more to business casual.",
          },
          {
            type: "bullets",
            items: [
              "**White shirt:** goes with every suit colour, with a tie in burgundy, navy or a subtle pattern.",
              "**Light blue shirt:** looks fresh with charcoal and navy; the tie can be dark and plain.",
              "**Striped shirt:** only with a plain or finely patterned tie, never with stripes of the same width.",
              "**Patterned suit:** keep shirt and tie simple.",
            ],
          },
          {
            type: "paragraph",
            text: "The basic rule is that only one element of the outfit may stand out. You will find more on [shirts](/kollektion/hemden) and on [accessories](/kollektion/accessoires) such as ties and belts in the collections.",
          },
        ],
      },
      {
        heading: "Small details that make the difference",
        blocks: [
          {
            type: "paragraph",
            text: "Polished shoes, a pressed shirt and a well-fitting suit make more impression than an expensive piece. The tie reaches the belt. Socks match the trousers and are long enough that no skin shows when you sit. The jacket is buttoned when standing and open when seated; on a two-button jacket the lower button always stays open. How a suit should fit is explained in the guide [Slim fit or regular fit](/ratgeber/slim-fit-oder-regular-fit).",
          },
        ],
      },
    ],
    summary: [
      "Business formal: suit, shirt with tie, black or dark brown leather shoes.",
      "Business casual: leave out one element, but stay polished and well fitted.",
      "Navy, charcoal and mid grey are the safest office colours.",
      "For interviews, dress one level more formally than is usual day to day.",
      "Only one element of the outfit may stand out.",
    ],
    faq: [
      {
        question: "Do I always have to wear a tie at the office?",
        answer:
          "No. In many companies the tie is only usual for client visits or special occasions. Watch what the team wears, and keep a tie ready for important meetings.",
      },
      {
        question: "Which colour suits a first office suit?",
        answer:
          "Navy is the most versatile because it goes with white, light blue and almost any tie. Charcoal is the more formal alternative.",
      },
      {
        question: "Can I wear trainers with a jacket at the office?",
        answer:
          "That depends on the company culture. In creative jobs it is often usual, in banks and law firms less so. Plain trainers in dark leather look tidiest.",
      },
      {
        question: "A black suit at the office: yes or no?",
        answer:
          "Many people see a black suit as evening wear. At the office, navy, charcoal and mid grey are more fitting and easier to combine.",
      },
    ],
    related: [
      { label: "Business occasion", path: "/kollektion/alle?anlass=business" },
      { label: "Suits", path: "/kollektion/anzuege" },
      { label: "Shirts", path: "/kollektion/hemden" },
      { label: "Accessories", path: "/kollektion/accessoires" },
      { label: "Shoes", path: "/kollektion/schuhe" },
    ],
  },

  "abschlussfeier-outfit": {
    intro:
      "Whether it is the Matura at a Gymnasium, a diploma ceremony at a university of applied sciences or the end of an apprenticeship: the celebration is a moment when family, friends and teachers come together and photos are taken. The outfit can be festive without looking like a costume. This guide shows what works in which setting.",
    sections: [
      {
        heading: "Judging the setting",
        blocks: [
          {
            type: "paragraph",
            text: "Check what the school or university says. A formal ceremony in the assembly hall with speeches and the handing over of certificates calls for more than an apéro in a garden. If there is no hint, a suit or a well-chosen combination of jacket and trousers is the safe choice. It is better to arrive a little too smart than to stand out in leisurewear among parents and guests.",
          },
          {
            type: "paragraph",
            text: "Many celebrations have several parts: the ceremony in the afternoon, a meal with the family and a party in the evening. Plan an outfit that survives all three, and bring a second shirt or other shoes if needed. You will find an overview under [the Graduation occasion](/kollektion/alle?anlass=abschlussfeier).",
          },
        ],
      },
      {
        heading: "The suit: safe and versatile",
        blocks: [
          {
            type: "paragraph",
            text: "A navy or charcoal suit suits almost any setting and can be used again later in working life: at your first interview, at the office or at a wedding. That makes it a purchase that stays useful beyond the day. The guide [Slim fit or regular fit](/ratgeber/slim-fit-oder-regular-fit) explains which cut suits you. You will find fitting models in the [suits](/kollektion/anzuege).",
          },
          {
            type: "paragraph",
            text: "To go with it: a white or light blue [shirt](/kollektion/hemden), a tie in a calm colour and dark leather shoes. A tie is not a must if the setting is relaxed; an open collar with a smart shirt looks just as tidy.",
          },
        ],
      },
      {
        heading: "The combination: relaxed, but polished",
        blocks: [
          {
            type: "paragraph",
            text: "If a suit seems too formal, a combination is a good alternative. A navy jacket goes with grey or beige [trousers](/kollektion/hosen). Add a shirt or a fine polo shirt, depending on the setting. That way you look festive and stay mobile, even when the day gets long. Make sure the pieces clearly belong together and do not look randomly assembled: if the trousers are almost the same colour as the jacket, it looks like a failed suit. Choose the pieces either the same or clearly different.",
          },
        ],
      },
      {
        heading: "Colours, shirt and shoes",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Colours:** navy, charcoal and mid grey are safe. Lighter shades look fresh in summer, dark ones in winter.",
              "**Shirt:** white or light blue, pressed and in the right collar size.",
              "**Shoes:** leather Oxfords or Derbies, polished. Trainers only suit a very relaxed celebration, and then in leather, without striking colours.",
              "**Accessories:** a pocket square or a tie in a colour you like brings personality to the picture.",
            ],
          },
          {
            type: "paragraph",
            text: "Patterns and colours are fine if only one part of the outfit stands out. [Shoes](/kollektion/schuhe) and [accessories](/kollektion/accessoires) offer more choice.",
          },
        ],
      },
      {
        heading: "Think practically",
        blocks: [
          {
            type: "paragraph",
            text: "Order the outfit a few weeks before the celebration and try it on with the shoes you plan to wear. If something is not right, there is time to exchange it; the conditions are set out under [Shipping and returns](/versand-und-rueckgabe). You will find the right size with the [size guide](/groessenberatung). Wear the shoes in for a few hours before the celebration so they do not pinch, and hang the suit up the evening before so that creases fall out. How to look after it afterwards is explained in the guide [Suit care](/ratgeber/anzug-pflegen).",
          },
        ],
      },
    ],
    summary: [
      "Consider the setting and any notes from the school or university; when in doubt, arrive slightly smarter.",
      "A navy or charcoal suit is safe and can be used again later.",
      "A combination of jacket and trousers is the relaxed alternative.",
      "Shirt pressed, shoes polished, accessories understated.",
      "Order the outfit early and try it on in peace.",
    ],
    faq: [
      {
        question: "Do I have to wear a suit to the Matura?",
        answer:
          "It is not compulsory, but it is widespread and a safe choice. A combination of jacket, trousers and shirt also looks festive. If in doubt, ask the school whether a dress code applies.",
      },
      {
        question: "Tie, yes or no?",
        answer:
          "At a formal ceremony the tie is fitting. At a relaxed celebration a smart shirt with an open collar is enough. You can always put a tie in your pocket and put it on if needed.",
      },
      {
        question: "Which colour is best?",
        answer:
          "Navy and charcoal are the most versatile. They look calm in photos and can be worn again later in working life. In summer mid grey or a lighter blue also works.",
      },
      {
        question: "Can I try it on at home and return it?",
        answer:
          "Yes, within the return period. You will find the conditions under «Shipping and returns». So do not order the outfit at the last minute.",
      },
    ],
    related: [
      { label: "Graduation occasion", path: "/kollektion/alle?anlass=abschlussfeier" },
      { label: "Suits", path: "/kollektion/anzuege" },
      { label: "Jackets", path: "/kollektion/sakkos" },
      { label: "Shirts", path: "/kollektion/hemden" },
      { label: "Shoes", path: "/kollektion/schuhe" },
      { label: "Size guide", path: "/groessenberatung" },
    ],
  },

  "anzug-pflegen": {
    intro:
      "A suit lasts for years if you treat it properly. Most of the care takes little effort: airing, brushing and hanging it on a good hanger. Cleaning, by contrast, is the exception, not the rule. This guide shows how to go about it. The care instructions on the label and in the product details always take precedence.",
    sections: [
      {
        heading: "After wearing: air it",
        blocks: [
          {
            type: "paragraph",
            text: "After each wearing, hang the suit on a hanger and leave it for a few hours in fresh air, ideally in a well-ventilated room, not in direct sunlight. Wool absorbs odours and moisture and releases them again as it airs. Empty the pockets so they do not bag out, and undo buttons and zips.",
          },
          {
            type: "paragraph",
            text: "Do not wear the same suit two days in a row. Between wearings the fabric needs time to recover and find its shape again. If you wear a suit to the office regularly, it is best to have at least two to alternate.",
          },
        ],
      },
      {
        heading: "Brushing instead of washing",
        blocks: [
          {
            type: "paragraph",
            text: "A soft clothes brush removes dust and fluff. Brush in the direction of the weave, from top to bottom, and pay attention to the collar, shoulders and pocket flaps. It takes a minute and keeps the fabric clean without stressing it. On dark suits you see the difference immediately.",
          },
        ],
      },
      {
        heading: "Hanging and storing",
        blocks: [
          {
            type: "bullets",
            items: [
              "**Hanger:** use a wide, shaped wooden hanger that supports the shoulders. Thin wire hangers press dents into the fabric.",
              "**Trousers:** hang them on a trouser hanger along the crease so that it is preserved.",
              "**Garment bag:** store the suit in a breathable garment bag made of cotton or fleece. Plastic covers trap moisture.",
              "**Space:** give the suit room in the wardrobe so that it is not squashed.",
              "**Moths:** woollens are attractive to moths. Cedar wood or lavender in the wardrobe helps but does not replace clean storage. Clean the suit before putting it away for a long time.",
            ],
          },
        ],
      },
      {
        heading: "Creases and stains",
        blocks: [
          {
            type: "paragraph",
            text: "Light creases often disappear by themselves if you hang the suit in the bathroom while you take a warm shower; the steam relaxes the fibres. For pressing, set a low to medium temperature and place a damp cloth between the iron and the fabric so that no shiny patches appear.",
          },
          {
            type: "paragraph",
            text: "Dab stains as quickly as possible with a clean, slightly damp cloth, working from the outside inwards. Do not rub, as that presses the stain deeper into the weave. With grease, wine or coffee it helps to blot the stain carefully and take the suit to be cleaned quickly, rather than experimenting with products yourself.",
          },
        ],
      },
      {
        heading: "When cleaning makes sense",
        blocks: [
          {
            type: "paragraph",
            text: "Clean a suit only when necessary: for visible stains, for odour that airing does not remove, or before storing it over the summer. Every cleaning stresses the fabric. As a rule of thumb, one or two cleanings a year are enough for a suit worn regularly. Take it to a cleaner familiar with woollen fabrics, and have jacket and trousers cleaned together so that the colour stays the same.",
          },
          {
            type: "paragraph",
            text: "The care symbols on the label show what is allowed. Further answers are under [Frequently asked questions](/haeufige-fragen) in the care section. Several [shirts](/kollektion/hemden) to alternate and a selection of [suits](/kollektion/anzuege) are part of good care too.",
          },
        ],
      },
      {
        heading: "Do not forget shoes and accessories",
        blocks: [
          {
            type: "paragraph",
            text: "[Shoes](/kollektion/schuhe) also last longer with care: wooden shoe trees keep the shape, and leather is brushed regularly and fed with cream. Hang ties up untied after wearing, or roll them loosely. You will find more on how suit and accessories work together under [Business dress code in Switzerland](/ratgeber/business-dresscode-schweiz).",
          },
        ],
      },
    ],
    summary: [
      "Air after each wearing and hang on a wide hanger.",
      "Brush regularly; it is gentler on the fabric than any cleaning.",
      "Do not wear the suit two days in a row.",
      "Clean only when necessary, about once or twice a year.",
      "Use a breathable garment bag rather than plastic.",
    ],
    faq: [
      {
        question: "How often should I have a suit cleaned?",
        answer:
          "As rarely as possible: once or twice a year with regular wear, or when there are visible stains. Airing and brushing keep it fresh in between.",
      },
      {
        question: "Can I put a suit in the washing machine?",
        answer:
          "As a rule, no. Check the care label: most woollen suits are meant for dry cleaning. Do not wash them on your own initiative.",
      },
      {
        question: "How do I remove creases without an iron?",
        answer:
          "Hang the suit somewhere with warm steam, for example in the bathroom. A garment steamer also works if you keep a distance from the fabric.",
      },
      {
        question: "How do I store a suit over the summer?",
        answer:
          "Clean it beforehand, hang it on a wide hanger and use a breathable garment bag. Store it dry and out of direct sunlight.",
      },
    ],
    related: [
      { label: "Suits", path: "/kollektion/anzuege" },
      { label: "Shirts", path: "/kollektion/hemden" },
      { label: "Shoes", path: "/kollektion/schuhe" },
      { label: "Frequently asked questions", path: "/haeufige-fragen" },
    ],
  },
  "stoffe-und-qualitaet": {
    intro:
      "Behind «virgin wool», «Super 120’s» or «cotton poplin» there is more than the label tells you at first glance. If you know the key terms, you can read a garment’s material line like an ingredients list: it tells you how the fabric wears, when it suits and how to look after it. This guide explains the common fabrics plainly and without promises that no label can keep.",
    sections: [
      {
        heading: "Virgin wool and merino",
        blocks: [
          {
            type: "paragraph",
            text: "Virgin wool is wool from live sheep that is being processed for the first time. It is the classic suit fabric because it absorbs and releases moisture, regulates warmth and drops out of its creases on its own after wearing. Merino wool comes from the merino breed and has particularly fine, soft fibres. That is why it itches less and also works for knitwear worn next to the skin.",
          },
          {
            type: "paragraph",
            text: "If a label simply says «wool» or «virgin wool» with nothing added, that is not a flaw. What counts is fibre fineness, yarn, weave and finishing together, not a single term.",
          },
        ],
      },
      {
        heading: "Super 100’s to 150’s: what the number really says",
        blocks: [
          {
            type: "paragraph",
            text: "The Super number describes the fineness of the wool fibre: the higher the number, the thinner the fibre on average. Roughly speaking, Super 100’s is about 18.5 and Super 150’s about 16 microns, where one micron is a thousandth of a millimetre.",
          },
          {
            type: "paragraph",
            text: "Finer fibres make the fabric softer and more supple, often with a slight sheen. They are not automatically better, though. Very fine cloths wear through faster and crease more easily, while a slightly coarser fabric is often sturdier and the more sensible choice for daily office wear. The number says nothing about how well a fabric is woven, finished and made up. It describes the fibre; it is not a quality guarantee.",
          },
        ],
      },
      {
        heading: "Fabric weight and seasons",
        blocks: [
          {
            type: "paragraph",
            text: "Fabric weight, also called grammage, is given in grams per square metre. It tells you how dense and heavy a cloth is. As rough guidelines, which vary depending on how they are measured:",
          },
          {
            type: "bullets",
            items: [
              "**Light (under about 250 g/m²):** airy and made for warm days, drapes softly but creases faster.",
              "**Medium (about 250 to 320 g/m²):** the all-rounder for most months of the year, equally at home in the office and at a celebration.",
              "**Heavy (over about 320 g/m²):** warm, stable in drape and meant for autumn and winter.",
            ],
          },
          {
            type: "paragraph",
            text: "A light fabric is not necessarily cooler: the weave and the fibre also decide how much air gets through. If you only want one suit for the whole year, a medium weight in navy or charcoal serves you best. You will find a selection in the [suits](/kollektion/anzuege).",
          },
        ],
      },
      {
        heading: "Linen and cotton",
        blocks: [
          {
            type: "paragraph",
            text: "Linen is made from flax. It is airy, absorbs moisture well and feels cool in the heat. It creases, and that is part of its character. Blends with wool or cotton keep the freshness but hang more calmly.",
          },
          {
            type: "paragraph",
            text: "With cotton, the weave matters most, and it sets the tone for [shirts](/kollektion/hemden):",
          },
          {
            type: "bullets",
            items: [
              "**Poplin:** woven dense and smooth, slightly glossy and fine. The classic business shirt.",
              "**Oxford:** coarser structure with a visible grain, sturdy and a little more casual. Typical for shirts with a button-down collar.",
              "**Twill:** diagonal rib, softer drape and fewer creases. Common in trousers and shirts.",
            ],
          },
        ],
      },
      {
        heading: "Cashmere",
        blocks: [
          {
            type: "paragraph",
            text: "Cashmere is the fine undercoat of the cashmere goat. The fabric is very soft and warms at low weight, especially in [knitwear](/kollektion/strick). It is more sensitive to abrasion, however, and forms small pills more easily in places that see a lot of wear. Blends with a share of cashmere give wool extra softness and stay more hard-wearing than pure cashmere. Treat cashmere gently, do not wear it every day and let it rest between wears.",
          },
        ],
      },
      {
        heading: "Lining: full, half or unlined",
        blocks: [
          {
            type: "paragraph",
            text: "The lining inside a jacket affects comfort and drape. A fully lined jacket glides easily over the shirt, holds its shape and is a little warmer. In half-lined jackets the lining covers only part of the back, which makes the jacket lighter and airier. Unlined models are the lightest but have less structure.",
          },
          {
            type: "paragraph",
            text: "Lining materials you often come across are cupro and viscose. Both are made from cellulose and are considered pleasantly breathable.",
          },
        ],
      },
      {
        heading: "Care by fabric",
        blocks: [
          {
            type: "paragraph",
            text: "Wool is aired and brushed, linen and cotton can be washed more simply depending on the label, and cashmere needs particular care. The care symbols on the label and the details on the product page always take precedence. You will find the basic routine for suits in the guide [Suit care](/ratgeber/anzug-pflegen), and more answers under [Frequently asked questions](/haeufige-fragen).",
          },
        ],
      },
    ],
    summary: [
      "The Super number describes the fineness of the wool fibre, not the quality of the finished fabric.",
      "Fabric weight sets the season: light for warmth, medium for the whole year, heavy for winter.",
      "Linen creases by nature, poplin is smooth, oxford sturdy and twill drapes softly.",
      "Cashmere is soft and delicate; blends with wool are more hard-wearing.",
      "Half-lined jackets are lighter and airier than fully lined ones.",
    ],
    faq: [
      {
        question: "Is Super 150’s better than Super 110’s?",
        answer:
          "Not automatically. The number tells you how fine the wool fibre is. Finer fabrics feel softer but are often more delicate. For everyday wear, how the fabric is woven and made up matters too.",
      },
      {
        question: "Which fabric weight suits the whole year?",
        answer:
          "A medium weight of roughly 250 to 320 grams per square metre is the usual compromise. It is not too warm in summer and wears well with an overcoat in winter.",
      },
      {
        question: "What is the difference between poplin and oxford?",
        answer:
          "Poplin is dense, smooth and fine, while oxford has a coarser, visible structure and looks more casual. Both are cotton; only the weave differs.",
      },
      {
        question: "Why does cashmere pill?",
        answer:
          "The fine, short fibres catch on points of friction and form small pills. That is normal. A knitwear comb removes them carefully.",
      },
    ],
    related: [
      { label: "Suits", path: "/kollektion/anzuege" },
      { label: "Shirts", path: "/kollektion/hemden" },
      { label: "Knitwear", path: "/kollektion/strick" },
      { label: "Suit care", path: "/ratgeber/anzug-pflegen" },
    ],
  },
};
