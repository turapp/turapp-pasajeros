export default function Loading() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', animation: 'trPop .7s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ font: '800 36px/1 Manrope,sans-serif', letterSpacing: '-.05em', color: 'var(--tx)' }}>Turapp</div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--jade)', marginBottom: '6px' }}></div>
      </div>
      <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2.5px solid var(--bd)', borderTopColor: 'var(--jade)', animation: 'trSpin .85s linear infinite' }}></div>
    </div>
  );
}
