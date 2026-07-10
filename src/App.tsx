import { useEffect } from 'react'
import { GameCanvas } from '@/components/game/GameCanvas'
import { GameErrorBoundary } from '@/components/game/GameErrorBoundary'
import { LoadingOverlay } from '@/components/game/LoadingOverlay'
import { GameHUD } from '@/components/hud/GameHUD'
import { BriefingScreen } from '@/components/screens/BriefingScreen'
import { GameOverScreen } from '@/components/screens/GameOverScreen'
import { MainMenu } from '@/components/screens/MainMenu'
import { PauseScreen } from '@/components/screens/PauseScreen'
import { VictoryScreen } from '@/components/screens/VictoryScreen'
import { useGameStore } from '@/stores/gameStore'

function App() {
  const screen = useGameStore((state) => state.screen)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return
      const game = useGameStore.getState()
      if (game.screen === 'playing') game.pause()
      else if (game.screen === 'paused') game.resume()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="solfront-app">
      <GameErrorBoundary>
        <GameCanvas />
      </GameErrorBoundary>

      {screen === 'menu' ? <MainMenu /> : null}
      {screen === 'briefing' ? <BriefingScreen /> : null}
      {screen === 'playing' ? <GameHUD /> : null}
      {screen === 'paused' ? <PauseScreen /> : null}
      {screen === 'gameover' ? <GameOverScreen /> : null}
      {screen === 'victory' ? <VictoryScreen /> : null}

      <LoadingOverlay />
    </div>
  )
}

export default App
