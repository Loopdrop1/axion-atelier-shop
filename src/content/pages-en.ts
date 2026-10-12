// English versions of the written pages. Missing pages fall back to German with a notice
// (legal texts: the German version is binding; the client supplies English legal texts).
import type { WrittenPage, WrittenPageHandle } from "./pages";

export const pagesEn: Partial<Record<WrittenPageHandle, WrittenPage>> = {};
