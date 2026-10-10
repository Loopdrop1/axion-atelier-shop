export function SizeGuide() {
  return (
    <>
      <p className="size-notice">Beispielwerte, werden ersetzt</p>
      <h2>Anzüge und Westen</h2>
      <div className="table-scroll">
        <table className="size-table">
          <thead>
            <tr>
              <th>Grösse</th>
              <th>Brustumfang</th>
              <th>Taillenumfang</th>
              <th>Körpergrösse</th>
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
      <h2>Schuhe</h2>
      <table className="size-table">
        <thead>
          <tr>
            <th>EU-Grösse</th>
            <th>Fusslänge in cm</th>
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
      <p className="size-notice mt-6">
        Miss den Brustumfang an der breitesten Stelle und die Taille an der schmalsten Stelle. Miss
        deine Fusslänge von der Ferse bis zum längsten Zeh.
      </p>
    </>
  );
}
