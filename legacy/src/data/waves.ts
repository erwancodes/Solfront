import type { WaveDefinition } from '@/types/game'

export const WAVE_DEFINITIONS: WaveDefinition[] = [
  { wave: 1, fighter: 3, interceptor: 0, bomber: 0, preparation: 4 },
  { wave: 2, fighter: 4, interceptor: 0, bomber: 0, preparation: 5 },
  { wave: 3, fighter: 4, interceptor: 1, bomber: 0, preparation: 5 },
  { wave: 4, fighter: 5, interceptor: 2, bomber: 0, preparation: 5 },
  { wave: 5, fighter: 5, interceptor: 2, bomber: 1, preparation: 6 },
  { wave: 6, fighter: 6, interceptor: 3, bomber: 1, preparation: 6 },
  { wave: 7, fighter: 6, interceptor: 4, bomber: 2, preparation: 6 },
  { wave: 8, fighter: 7, interceptor: 4, bomber: 2, preparation: 7 },
  { wave: 9, fighter: 8, interceptor: 5, bomber: 2, preparation: 7 },
  { wave: 10, fighter: 8, interceptor: 5, bomber: 3, preparation: 8 },
]
