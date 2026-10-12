// Herkunft des Englisch im Produktformular: Scheitert ein Speichern oder wird zweimal gespeichert, bevor die Seite
// neu lädt, bleibt maschinelles Englisch maschinell (en_auto) und folgt weiter dem Deutschen.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/admin/api", async (orig) => ({
  ...((await orig()) as Record<string, unknown>),
  translateTexts: vi.fn(async (texts: string[]) => texts.map((t) => (t.trim() ? `MT(${t})` : ""))),
}));

import { ProductForm, type ProductValues } from "./product-form";

const category = { id: "c1", slug: "anzuege", name_de: "Anzüge" } as never;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("ProductForm: Herkunft des Englisch", () => {
  it("Speichern scheitert (Adresse vergeben), zweiter Versuch: Englisch bleibt maschinell und folgt dem Deutschen", async () => {
    const calls: ProductValues[] = [];
    const onSave = vi.fn(async (values: ProductValues) => {
      calls.push(values);
      if (calls.length === 1) throw new Error("23505");
    });
    render(<ProductForm product={null} categories={[category]} products={[]} onSave={onSave} />);
    fill("Titel", "Anzug Limmat");
    fill("Farbname", "Marine");
    fill("Preis (CHF, inkl. MWST)", "489");
    fill("Beschreibung", "Aus Wolle.");
    const submit = screen.getByRole("button", { name: /Produkt anlegen/ });
    fireEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit).not.toBeDisabled());
    expect(calls[0]!.en_auto).toEqual(["color_name", "description", "title"]);

    // Adresse korrigieren und das Deutsch noch ändern, dann erneut speichern
    fill("Adresse im Shop", "anzug-limmat-2");
    fill("Beschreibung", "Aus Leinen.");
    fireEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(calls[1]!.en_auto).toEqual(["color_name", "description", "title"]);
    expect(calls[1]!.description_en).toBe("MT(Aus Leinen.)");
  });

  it("zweimal speichern, bevor die Seite neu lädt: gleiche Herkunft", async () => {
    const product = {
      id: "p1",
      handle: "anzug-limmat-marine",
      model: "anzug-limmat",
      category_id: "c1",
      status: "draft",
      sort: 0,
      price_cents: 48900,
      compare_at_cents: null,
      title_de: "Anzug Limmat",
      title_en: null,
      color_name_de: "Marine",
      color_name_en: null,
      color_hex: "#1E3A2F",
      description_de: "Aus Wolle.",
      description_en: null,
      material_de: null,
      material_en: null,
      care_de: null,
      care_en: null,
      fit_note_de: null,
      fit_note_en: null,
      fit: null,
      occasions: [],
      tags: [],
      outfit_handles: [],
      en_auto: [],
      created_at: "x",
      updated_at: "t1",
    } as never;
    const calls: ProductValues[] = [];
    const onSave = vi.fn(async (values: ProductValues) => {
      calls.push(values);
    });
    render(<ProductForm product={product} categories={[category]} products={[]} onSave={onSave} />);
    const submit = screen.getByRole("button", { name: /Änderungen speichern/ });
    fireEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(calls[0]!.en_auto).toEqual(["color_name", "description", "title"]);
    expect(calls[1]!.en_auto).toEqual(calls[0]!.en_auto);
  });
});
