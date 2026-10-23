export function Crosshair() {
  return (
    <div className="crosshair" aria-hidden="true">
      <span className="crosshair__line crosshair__line--top" />
      <span className="crosshair__line crosshair__line--right" />
      <span className="crosshair__line crosshair__line--bottom" />
      <span className="crosshair__line crosshair__line--left" />
      <span className="crosshair__dot" />
      <span className="crosshair__arc crosshair__arc--one" />
      <span className="crosshair__arc crosshair__arc--two" />
    </div>
  )
}
