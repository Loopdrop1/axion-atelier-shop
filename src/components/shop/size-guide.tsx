import { useT } from "@/i18n";
export function SizeGuide() {
  const t = useT().sizeGuide;
  return (
    <>
      <p className="size-notice">{t.notice}</p>
      <h2>{t.suits}</h2>
      <div className="table-scroll">
        <table className="size-table">
          <thead>
            <tr>
              <th>{t.size}</th>
              <th>{t.chest}</th>
              <th>{t.waist}</th>
              <th>{t.height}</th>
            </tr>
          </thead>
          <tbody>
            {[46, 48, 50, 52, 54, 56].map((s, i) => (
              <tr key={s}>
                <td>{s}</td>
                <td>{92 + i * 4} cm</td>
                <td>{80 + i * 4} cm</td>
                <td>
                  {170 + i * 3}–{176 + i * 3} cm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{t.shoes}</h2>
      <table className="size-table">
        <thead>
          <tr>
            <th>{t.euSize}</th>
            <th>{t.footLength}</th>
          </tr>
        </thead>
        <tbody>
          {[40, 41, 42, 43, 44, 45, 46].map((s, i) => (
            <tr key={s}>
              <td>{s}</td>
              <td>{(25.3 + i * 0.7).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="size-notice mt-6">{t.howTo}</p>
    </>
  );
}
