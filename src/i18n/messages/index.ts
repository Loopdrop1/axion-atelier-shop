import type { Locale } from "../locale";
import { de, type Messages } from "./de";
import { en } from "./en";

export type { Messages };
export const messages: Record<Locale, Messages> = { de, en };
