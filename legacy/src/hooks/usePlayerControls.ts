import { useEffect, useRef } from 'react'

export interface PlayerControlState {
  keys: Set<string>
  mouseX: number
  mouseY: number
  firing: boolean
  lockRequested: boolean
  targetRequested: boolean
  dodgeRequested: boolean
}

export function usePlayerControls(enabled: boolean) {
  const controls = useRef<PlayerControlState>({
    keys: new Set<string>(),
    mouseX: 0,
    mouseY: 0,
    firing: false,
    lockRequested: false,
    targetRequested: false,
    dodgeRequested: false,
  })

  useEffect(() => {
    if (!enabled) {
      controls.current.keys.clear()
      controls.current.firing = false
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      controls.current.keys.add(event.code)
      if (event.code === 'KeyR' && !event.repeat) controls.current.targetRequested = true
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        controls.current.dodgeRequested = true
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      controls.current.keys.delete(event.code)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (document.pointerLockElement) {
        controls.current.mouseX += event.movementX
        controls.current.mouseY += event.movementY
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'CANVAS' && !document.pointerLockElement) {
        try {
          void target.requestPointerLock().catch(() => undefined)
        } catch {
          // Pointer lock can be unavailable in embedded browsers; keyboard flight remains usable.
        }
      }
      if (event.button === 0) controls.current.firing = true
      if (event.button === 2) controls.current.lockRequested = true
    }

    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 0) controls.current.firing = false
    }

    const onContextMenu = (event: MouseEvent) => event.preventDefault()
    const onBlur = () => {
      controls.current.keys.clear()
      controls.current.firing = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('blur', onBlur)
    }
  }, [enabled])

  return controls
}
