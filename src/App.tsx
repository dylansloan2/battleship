import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import { Anchor, RotateCw, Play, RefreshCw, Crosshair, Shield, Trophy, ArrowLeft, Settings, Volume2, VolumeX } from 'lucide-react'

const BOARD_SIZE = 10
const EMPTY = 0
const SHIP = 1
const HIT = 2
const MISS = 3
const SUNK = 4

type Cell = typeof EMPTY | typeof SHIP | typeof HIT | typeof MISS | typeof SUNK
type Board = Cell[][]
type Coordinate = { row: number; col: number }

interface ShipConfig {
  name: string
  size: number
  placed: boolean
}

const SHIPS_CONFIG: ShipConfig[] = [
  { name: 'Carrier', size: 5, placed: false },
  { name: 'Battleship', size: 4, placed: false },
  { name: 'Cruiser', size: 3, placed: false },
  { name: 'Submarine', size: 3, placed: false },
  { name: 'Destroyer', size: 2, placed: false },
]

interface PlacedShip {
  name: string
  size: number
  coords: Coordinate[]
  sunk: boolean
}

type Difficulty = 'easy' | 'medium' | 'hard'
type GamePhase = 'difficulty' | 'placement' | 'battle' | 'gameover'

interface Opponent {
  id: Difficulty
  name: string
  title: string
  image: string
  description: string
  level: number
}

const OPPONENTS: Opponent[] = [
  {
    id: 'easy',
    name: 'Rob Gronkowski',
    title: 'The Party Animal',
    image: '/images/gronkowski.jpg',
    description: 'Gronk fires randomly -- not the sharpest strategist on the seas!',
    level: 1,
  },
  {
    id: 'medium',
    name: 'Elon Musk',
    title: 'The Innovator',
    image: '/images/elon.jpg',
    description: 'Elon uses smart targeting -- hunts down your ships after a hit.',
    level: 2,
  },
  {
    id: 'hard',
    name: 'Magnus Carlsen',
    title: 'The Grandmaster',
    image: '/images/magnus.jpg',
    description: 'Magnus plays chess-level strategy -- probability-based targeting.',
    level: 3,
  },
]

interface LeaderboardEntry {
  opponent: string
  shots: number
  date: string
}

function getLeaderboard(): LeaderboardEntry[] {
  try {
    const data = localStorage.getItem('battleship-leaderboard')
    if (data) return JSON.parse(data)
  } catch { /* empty */ }
  return []
}

function saveToLeaderboard(entry: LeaderboardEntry) {
  const lb = getLeaderboard()
  lb.push(entry)
  lb.sort((a, b) => a.shots - b.shots)
  localStorage.setItem('battleship-leaderboard', JSON.stringify(lb.slice(0, 50)))
}

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY))
}

function canPlaceShip(board: Board, row: number, col: number, size: number, horizontal: boolean): boolean {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i
    const c = horizontal ? col + i : col
    if (r >= BOARD_SIZE || c >= BOARD_SIZE) return false
    if (board[r][c] !== EMPTY) return false
  }
  return true
}

function placeShipOnBoard(board: Board, row: number, col: number, size: number, horizontal: boolean): { board: Board; coords: Coordinate[] } {
  const newBoard = board.map(r => [...r])
  const coords: Coordinate[] = []
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i
    const c = horizontal ? col + i : col
    newBoard[r][c] = SHIP
    coords.push({ row: r, col: c })
  }
  return { board: newBoard, coords }
}

function randomPlacement(ships: ShipConfig[]): { board: Board; placedShips: PlacedShip[] } {
  let board = createEmptyBoard()
  const placedShips: PlacedShip[] = []

  for (const ship of ships) {
    let placed = false
    while (!placed) {
      const horizontal = Math.random() > 0.5
      const row = Math.floor(Math.random() * BOARD_SIZE)
      const col = Math.floor(Math.random() * BOARD_SIZE)
      if (canPlaceShip(board, row, col, ship.size, horizontal)) {
        const result = placeShipOnBoard(board, row, col, ship.size, horizontal)
        board = result.board
        placedShips.push({ name: ship.name, size: ship.size, coords: result.coords, sunk: false })
        placed = true
      }
    }
  }
  return { board, placedShips }
}

function checkSunk(ship: PlacedShip, board: Board): boolean {
  return ship.coords.every(c => board[c.row][c.col] === HIT || board[c.row][c.col] === SUNK)
}

function markSunk(board: Board, ship: PlacedShip): Board {
  const newBoard = board.map(r => [...r])
  ship.coords.forEach(c => { newBoard[c.row][c.col] = SUNK })
  return newBoard
}

function computeProbabilityMap(board: Board, ships: PlacedShip[]): number[][] {
  const prob: number[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
  const remainingShips = ships.filter(s => !s.sunk)

  for (const ship of remainingShips) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        for (const horizontal of [true, false]) {
          let valid = true
          const cells: Coordinate[] = []
          for (let i = 0; i < ship.size; i++) {
            const cr = horizontal ? r : r + i
            const cc = horizontal ? c + i : c
            if (cr >= BOARD_SIZE || cc >= BOARD_SIZE) { valid = false; break }
            const cell = board[cr][cc]
            if (cell === MISS || cell === SUNK) { valid = false; break }
            cells.push({ row: cr, col: cc })
          }
          if (valid) {
            const hasHit = cells.some(coord => board[coord.row][coord.col] === HIT)
            const weight = hasHit ? 20 : 1
            cells.forEach(coord => {
              if (board[coord.row][coord.col] === EMPTY || board[coord.row][coord.col] === SHIP) {
                prob[coord.row][coord.col] += weight
              }
            })
          }
        }
      }
    }
  }
  return prob
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

function getSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem('battleship-sound')
    if (val !== null) return val === 'true'
  } catch { /* empty */ }
  return true
}

function setSoundEnabled(enabled: boolean) {
  localStorage.setItem('battleship-sound', String(enabled))
}

let audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playHitSound() {
  const ctx = getAudioCtx()
  const t = ctx.currentTime

  const boom = ctx.createOscillator()
  const boomGain = ctx.createGain()
  boom.connect(boomGain)
  boomGain.connect(ctx.destination)
  boom.type = 'sine'
  boom.frequency.setValueAtTime(120, t)
  boom.frequency.exponentialRampToValueAtTime(30, t + 0.3)
  boomGain.gain.setValueAtTime(0.6, t)
  boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35)
  boom.start(t)
  boom.stop(t + 0.35)

  const crack = ctx.createOscillator()
  const crackGain = ctx.createGain()
  crack.connect(crackGain)
  crackGain.connect(ctx.destination)
  crack.type = 'square'
  crack.frequency.setValueAtTime(800, t + 0.02)
  crack.frequency.exponentialRampToValueAtTime(100, t + 0.12)
  crackGain.gain.setValueAtTime(0, t)
  crackGain.gain.linearRampToValueAtTime(0.25, t + 0.02)
  crackGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15)
  crack.start(t)
  crack.stop(t + 0.15)

  const impactNoise = ctx.createBufferSource()
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate)
  const noiseData = noiseBuf.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1)
  impactNoise.buffer = noiseBuf
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.setValueAtTime(600, t)
  noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.4)
  noiseFilter.Q.setValueAtTime(1.5, t)
  const noiseGain = ctx.createGain()
  impactNoise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noiseGain.gain.setValueAtTime(0.35, t + 0.01)
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4)
  impactNoise.start(t + 0.01)

  const splash = ctx.createBufferSource()
  const splashBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
  const splashData = splashBuf.getChannelData(0)
  for (let i = 0; i < splashData.length; i++) splashData[i] = (Math.random() * 2 - 1)
  splash.buffer = splashBuf
  const splashFilter = ctx.createBiquadFilter()
  splashFilter.type = 'highpass'
  splashFilter.frequency.setValueAtTime(2000, t + 0.05)
  splashFilter.frequency.exponentialRampToValueAtTime(400, t + 0.35)
  const splashGain = ctx.createGain()
  splash.connect(splashFilter)
  splashFilter.connect(splashGain)
  splashGain.connect(ctx.destination)
  splashGain.gain.setValueAtTime(0, t)
  splashGain.gain.linearRampToValueAtTime(0.15, t + 0.06)
  splashGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35)
  splash.start(t + 0.05)
}

function playMissSound() {
  const ctx = getAudioCtx()
  const noise = ctx.createBufferSource()
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15
  noise.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(800, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25)
  const gain = ctx.createGain()
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.25, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
  noise.start(ctx.currentTime)
}

function CellDisplay({ cell, isPlayer, onClick, isHover }: { cell: Cell; isPlayer: boolean; onClick?: () => void; isHover?: boolean }) {
  let bg = 'bg-sky-900'
  let content = ''
  let ring = ''

  if (cell === SHIP && isPlayer) {
    bg = 'bg-slate-500'
  } else if (cell === HIT) {
    bg = 'bg-red-600'
    content = 'X'
  } else if (cell === MISS) {
    bg = 'bg-sky-700'
    content = '\u25CF'
  } else if (cell === SUNK) {
    bg = 'bg-red-800'
    content = 'X'
  }

  if (isHover) {
    ring = 'ring-2 ring-yellow-400 ring-inset'
  }

  return (
    <button
      className={`w-9 h-9 ${bg} ${ring} border border-sky-950 flex items-center justify-center text-white font-bold text-sm transition-all duration-100 hover:brightness-125 cursor-crosshair`}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

function BoardGrid({
  board,
  isPlayer,
  onCellClick,
  hoverCells,
  onCellHover,
  onMouseLeave,
  placementPreview,
  label,
  icon,
}: {
  board: Board
  isPlayer: boolean
  onCellClick?: (row: number, col: number) => void
  hoverCells?: Set<string>
  onCellHover?: (row: number, col: number) => void
  onMouseLeave?: () => void
  placementPreview?: Set<string>
  label: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-bold text-white tracking-wide uppercase">{label}</h2>
      </div>
      <div className="bg-sky-950 p-1 rounded-lg shadow-xl shadow-black/40">
        <div className="flex">
          <div className="w-9 h-9" />
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <div key={i} className="w-9 h-9 flex items-center justify-center text-xs font-bold text-sky-400">
              {i + 1}
            </div>
          ))}
        </div>
        {board.map((row, ri) => (
          <div key={ri} className="flex">
            <div className="w-9 h-9 flex items-center justify-center text-xs font-bold text-sky-400">
              {LETTERS[ri]}
            </div>
            {row.map((cell, ci) => {
              const key = `${ri},${ci}`
              const isInPreview = placementPreview?.has(key)
              const isHov = hoverCells?.has(key)
              let displayCell = cell
              if (isInPreview && cell === EMPTY) {
                displayCell = SHIP
              }
              return (
                <div
                  key={ci}
                  onMouseEnter={() => onCellHover?.(ri, ci)}
                  onMouseLeave={onMouseLeave}
                >
                  <CellDisplay
                    cell={displayCell}
                    isPlayer={isPlayer || !!isInPreview}
                    onClick={() => onCellClick?.(ri, ci)}
                    isHover={!!isHov}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DifficultySelect({ onSelect }: { onSelect: (d: Difficulty) => void }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  useEffect(() => {
    setLeaderboard(getLeaderboard())
  }, [])

  if (showLeaderboard) {
    return (
      <div className="flex flex-col items-center gap-6 p-4 max-w-2xl mx-auto">
        <button
          onClick={() => setShowLeaderboard(false)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors self-end"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-3">
          <Trophy className="text-yellow-400" size={28} />
          <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
          <Trophy className="text-yellow-400" size={28} />
        </div>
        <p className="text-sky-300 text-sm">Fewest shots to win -- lower is better!</p>
        {leaderboard.length === 0 ? (
          <p className="text-sky-400 text-lg mt-8">No games played yet. Beat an opponent to get on the board!</p>
        ) : (
          <div className="w-full bg-slate-800/60 rounded-xl border border-sky-800/40 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-sky-800/40">
                  <th className="px-4 py-3 text-left text-sky-400 text-sm font-semibold">#</th>
                  <th className="px-4 py-3 text-left text-sky-400 text-sm font-semibold">Opponent</th>
                  <th className="px-4 py-3 text-left text-sky-400 text-sm font-semibold">Shots</th>
                  <th className="px-4 py-3 text-left text-sky-400 text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 20).map((entry, i) => (
                  <tr key={i} className={`border-b border-sky-900/30 ${i < 3 ? 'bg-yellow-900/10' : ''}`}>
                    <td className="px-4 py-2.5 text-white font-bold">
                      {i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : i + 1}
                    </td>
                    <td className="px-4 py-2.5 text-sky-200">{entry.opponent}</td>
                    <td className="px-4 py-2.5 text-white font-bold">{entry.shots}</td>
                    <td className="px-4 py-2.5 text-sky-400 text-sm">{entry.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Opponent</h2>
        <p className="text-sky-300 text-sm">Each opponent has a different skill level</p>
      </div>
      <div className="flex flex-wrap justify-center gap-6">
        {OPPONENTS.map(opp => (
          <button
            key={opp.id}
            onClick={() => onSelect(opp.id)}
            className="group flex flex-col items-center gap-3 p-5 bg-slate-800/70 hover:bg-slate-700/80 border-2 border-sky-800/40 hover:border-sky-500/60 rounded-2xl transition-all duration-200 w-64 hover:scale-105 hover:shadow-xl hover:shadow-sky-900/30"
          >
            <div className="relative">
              <img
                src={opp.image}
                alt={opp.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-sky-700/50 group-hover:border-sky-500/70 transition-colors"
              />
              <div className="absolute -bottom-2 -right-2 bg-sky-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                Lvl {opp.level}
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">{opp.name}</h3>
              <p className="text-sky-400 text-sm font-medium">{opp.title}</p>
              <div className="flex justify-center gap-1 mt-1.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full ${i < opp.level ? 'bg-yellow-400' : 'bg-slate-600'}`}
                  />
                ))}
              </div>
              <p className="text-sky-300/70 text-xs mt-2 leading-relaxed">{opp.description}</p>
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setShowLeaderboard(true)}
        className="flex items-center gap-2 px-6 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 rounded-xl font-bold transition-all"
      >
        <Trophy size={20} />
        View Leaderboard
      </button>
    </div>
  )
}

function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('difficulty')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [playerBoard, setPlayerBoard] = useState<Board>(createEmptyBoard)
  const [computerBoard, setComputerBoard] = useState<Board>(createEmptyBoard)
  const [computerVisibleBoard, setComputerVisibleBoard] = useState<Board>(createEmptyBoard)
  const [playerShips, setPlayerShips] = useState<PlacedShip[]>([])
  const [computerShips, setComputerShips] = useState<PlacedShip[]>([])
  const [shipsToPlace, setShipsToPlace] = useState<ShipConfig[]>(SHIPS_CONFIG.map(s => ({ ...s })))
  const [currentShipIndex, setCurrentShipIndex] = useState(0)
  const [isHorizontal, setIsHorizontal] = useState(true)
  const [hoverCells, setHoverCells] = useState<Set<string>>(new Set())
  const [playerTurn, setPlayerTurn] = useState(true)
  const [message, setMessage] = useState('Place your Carrier (5 cells)')
  const [winner, setWinner] = useState<'player' | 'computer' | null>(null)
  const [playerShotCount, setPlayerShotCount] = useState(0)

  const [aiHits, setAiHits] = useState<Coordinate[]>([])
  const [aiQueue, setAiQueue] = useState<Coordinate[]>([])
  const [soundOn, setSoundOn] = useState(getSoundEnabled)
  const [showSettings, setShowSettings] = useState(false)
  const soundOnRef = useRef(soundOn)

  const currentShip = shipsToPlace[currentShipIndex]
  const opponent = OPPONENTS.find(o => o.id === difficulty)!

  useEffect(() => {
    soundOnRef.current = soundOn
    setSoundEnabled(soundOn)
  }, [soundOn])

  const handleDifficultySelect = useCallback((d: Difficulty) => {
    setDifficulty(d)
    setGamePhase('placement')
    setMessage(`Place your ${SHIPS_CONFIG[0].name} (${SHIPS_CONFIG[0].size} cells)`)
  }, [])

  const handlePlacementHover = useCallback((row: number, col: number) => {
    if (gamePhase !== 'placement' || !currentShip) return
    const cells = new Set<string>()
    const valid = canPlaceShip(playerBoard, row, col, currentShip.size, isHorizontal)
    if (valid) {
      for (let i = 0; i < currentShip.size; i++) {
        const r = isHorizontal ? row : row + i
        const c = isHorizontal ? col + i : col
        cells.add(`${r},${c}`)
      }
    }
    setHoverCells(cells)
  }, [gamePhase, currentShip, playerBoard, isHorizontal])

  const handlePlacementClick = useCallback((row: number, col: number) => {
    if (gamePhase !== 'placement' || !currentShip) return
    if (!canPlaceShip(playerBoard, row, col, currentShip.size, isHorizontal)) return

    const { board: newBoard, coords } = placeShipOnBoard(playerBoard, row, col, currentShip.size, isHorizontal)
    setPlayerBoard(newBoard)
    setPlayerShips(prev => [...prev, { name: currentShip.name, size: currentShip.size, coords, sunk: false }])

    const newShips = shipsToPlace.map((s, i) => i === currentShipIndex ? { ...s, placed: true } : s)
    setShipsToPlace(newShips)

    if (currentShipIndex < shipsToPlace.length - 1) {
      const nextIdx = currentShipIndex + 1
      setCurrentShipIndex(nextIdx)
      setMessage(`Place your ${shipsToPlace[nextIdx].name} (${shipsToPlace[nextIdx].size} cells)`)
    } else {
      setMessage('All ships placed! Press Start Battle to begin.')
    }
    setHoverCells(new Set())
  }, [gamePhase, currentShip, playerBoard, isHorizontal, currentShipIndex, shipsToPlace])

  const startBattle = useCallback(() => {
    const { board, placedShips } = randomPlacement(SHIPS_CONFIG)
    setComputerBoard(board)
    setComputerShips(placedShips)
    setGamePhase('battle')
    setMessage(`Your turn! Click on ${opponent.name}'s board to fire.`)
    setPlayerTurn(true)
    setPlayerShotCount(0)
  }, [opponent])

  const handleRandomPlacement = useCallback(() => {
    const { board, placedShips } = randomPlacement(SHIPS_CONFIG)
    setPlayerBoard(board)
    setPlayerShips(placedShips)
    setShipsToPlace(SHIPS_CONFIG.map(s => ({ ...s, placed: true })))
    setCurrentShipIndex(SHIPS_CONFIG.length)
    setMessage('All ships placed! Press Start Battle to begin.')
    setHoverCells(new Set())
  }, [])

  const handleResetPlacement = useCallback(() => {
    setPlayerBoard(createEmptyBoard())
    setPlayerShips([])
    setShipsToPlace(SHIPS_CONFIG.map(s => ({ ...s })))
    setCurrentShipIndex(0)
    setIsHorizontal(true)
    setMessage(`Place your ${SHIPS_CONFIG[0].name} (${SHIPS_CONFIG[0].size} cells)`)
    setHoverCells(new Set())
  }, [])

  const computerTurnEasy = useCallback(() => {
    const available: Coordinate[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (playerBoard[r][c] === EMPTY || playerBoard[r][c] === SHIP) {
          available.push({ row: r, col: c })
        }
      }
    }
    if (available.length === 0) return null
    return available[Math.floor(Math.random() * available.length)]
  }, [playerBoard])

  const computerTurnMedium = useCallback(() => {
    const queue = [...aiQueue]
    const hits = [...aiHits]

    while (queue.length > 0) {
      const candidate = queue.shift()!
      if (playerBoard[candidate.row][candidate.col] === EMPTY || playerBoard[candidate.row][candidate.col] === SHIP) {
        return { target: candidate, hits, queue }
      }
    }

    const available: Coordinate[] = []
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (playerBoard[r][c] === EMPTY || playerBoard[r][c] === SHIP) {
          available.push({ row: r, col: c })
        }
      }
    }
    if (available.length === 0) return null
    return { target: available[Math.floor(Math.random() * available.length)], hits, queue }
  }, [playerBoard, aiQueue, aiHits])

  const computerTurnHard = useCallback(() => {
    const probMap = computeProbabilityMap(playerBoard, playerShips)
    let maxProb = -1
    const candidates: Coordinate[] = []

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (playerBoard[r][c] === EMPTY || playerBoard[r][c] === SHIP) {
          if (probMap[r][c] > maxProb) {
            maxProb = probMap[r][c]
            candidates.length = 0
            candidates.push({ row: r, col: c })
          } else if (probMap[r][c] === maxProb) {
            candidates.push({ row: r, col: c })
          }
        }
      }
    }
    if (candidates.length === 0) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  }, [playerBoard, playerShips])

  const computerTurn = useCallback(() => {
    setPlayerTurn(false)
    setMessage(`${opponent.name} is firing...`)

    setTimeout(() => {
      let target: Coordinate | null = null
      let newHits = [...aiHits]
      let newQueue = [...aiQueue]

      if (difficulty === 'easy') {
        target = computerTurnEasy()
      } else if (difficulty === 'medium') {
        const result = computerTurnMedium()
        if (result) {
          target = result.target
          newHits = result.hits
          newQueue = result.queue
        }
      } else {
        target = computerTurnHard()
      }

      if (!target) return

      const newBoard = playerBoard.map(r => [...r])

      if (newBoard[target.row][target.col] === SHIP) {
        newBoard[target.row][target.col] = HIT
        if (soundOnRef.current) playHitSound()

        if (difficulty === 'medium') {
          newHits = [...newHits, target]
          const dirs = [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
          ]
          const neighbors: Coordinate[] = []
          for (const d of dirs) {
            const nr = target.row + d.row
            const nc = target.col + d.col
            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
              if (newBoard[nr][nc] === EMPTY || newBoard[nr][nc] === SHIP) {
                neighbors.push({ row: nr, col: nc })
              }
            }
          }
          newQueue = [...newQueue, ...neighbors]
        }

        const updatedPlayerShips = playerShips.map(s => {
          if (!s.sunk && checkSunk(s, newBoard)) {
            s.coords.forEach(c => { newBoard[c.row][c.col] = SUNK })
            if (difficulty === 'medium') {
              newHits = newHits.filter(h => !s.coords.some(c => c.row === h.row && c.col === h.col))
              newQueue = newQueue.filter(q => {
                const cellVal = newBoard[q.row]?.[q.col]
                return cellVal !== SUNK && cellVal !== HIT && cellVal !== MISS
              })
            }
            return { ...s, sunk: true }
          }
          return s
        })
        setPlayerShips(updatedPlayerShips)

        const allSunk = updatedPlayerShips.every(s => s.sunk)
        if (allSunk) {
          setPlayerBoard(newBoard)
          setAiHits(newHits)
          setAiQueue(newQueue)
          setWinner('computer')
          setGamePhase('gameover')
          setMessage(`${opponent.name} wins! All your ships are sunk.`)
          return
        }
      } else {
        newBoard[target.row][target.col] = MISS
        if (soundOnRef.current) playMissSound()
      }

      setPlayerBoard(newBoard)
      setAiHits(newHits)
      setAiQueue(newQueue)
      setPlayerTurn(true)
      setMessage(`Your turn! Click on ${opponent.name}'s board to fire.`)
    }, 600)
  }, [playerBoard, playerShips, aiHits, aiQueue, difficulty, opponent, computerTurnEasy, computerTurnMedium, computerTurnHard])

  const handleAttack = useCallback((row: number, col: number) => {
    if (gamePhase !== 'battle' || !playerTurn) return
    if (computerVisibleBoard[row][col] !== EMPTY) return

    setPlayerShotCount(prev => prev + 1)
    const newVisible = computerVisibleBoard.map(r => [...r])
    const newActual = computerBoard.map(r => [...r])

    if (computerBoard[row][col] === SHIP) {
      newVisible[row][col] = HIT
      newActual[row][col] = HIT
      if (soundOnRef.current) playHitSound()

      const updatedShips = computerShips.map(s => {
        if (!s.sunk && checkSunk(s, newActual)) {
          const sb = markSunk(newVisible, s)
          const sa = markSunk(newActual, s)
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              newVisible[r][c] = sb[r][c]
              newActual[r][c] = sa[r][c]
            }
          }
          return { ...s, sunk: true }
        }
        return s
      })
      setComputerShips(updatedShips)

      setComputerVisibleBoard(newVisible)
      setComputerBoard(newActual)

      const allSunk = updatedShips.every(s => s.sunk)
      if (allSunk) {
        const finalShots = playerShotCount + 1
        setWinner('player')
        setGamePhase('gameover')
        setMessage(`You defeated ${opponent.name} in ${finalShots} shots!`)
        saveToLeaderboard({
          opponent: opponent.name,
          shots: finalShots,
          date: new Date().toLocaleDateString(),
        })
        return
      }
      setMessage('Direct hit!')
    } else {
      newVisible[row][col] = MISS
      if (soundOnRef.current) playMissSound()
      setComputerVisibleBoard(newVisible)
      setMessage('Miss!')
    }

    setTimeout(() => computerTurn(), 400)
  }, [gamePhase, playerTurn, computerVisibleBoard, computerBoard, computerShips, computerTurn, playerShotCount, opponent])

  const handleBattleHover = useCallback((row: number, col: number) => {
    if (gamePhase !== 'battle' || !playerTurn) return
    if (computerVisibleBoard[row][col] !== EMPTY) return
    setHoverCells(new Set([`${row},${col}`]))
  }, [gamePhase, playerTurn, computerVisibleBoard])

  const resetGame = useCallback(() => {
    setGamePhase('difficulty')
    setPlayerBoard(createEmptyBoard())
    setComputerBoard(createEmptyBoard())
    setComputerVisibleBoard(createEmptyBoard())
    setPlayerShips([])
    setComputerShips([])
    setShipsToPlace(SHIPS_CONFIG.map(s => ({ ...s })))
    setCurrentShipIndex(0)
    setIsHorizontal(true)
    setHoverCells(new Set())
    setPlayerTurn(true)
    setMessage(`Place your ${SHIPS_CONFIG[0].name} (${SHIPS_CONFIG[0].size} cells)`)
    setWinner(null)
    setAiHits([])
    setAiQueue([])
    setPlayerShotCount(0)
  }, [])

  const allPlaced = shipsToPlace.every(s => s.placed)

  const playerSunkCount = playerShips.filter(s => s.sunk).length
  const computerSunkCount = computerShips.filter(s => s.sunk).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 bg-slate-900/60 border-b border-sky-800/40">
        <div className="w-10" />
        <div className="flex items-center gap-3">
          <Anchor className="text-sky-400" size={32} />
          <h1 className="text-3xl font-extrabold text-white tracking-widest uppercase">Battleship</h1>
          <Anchor className="text-sky-400" size={32} />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-sky-400 hover:text-white transition-colors rounded-lg hover:bg-sky-800/40"
            title="Settings"
          >
            <Settings size={22} />
          </button>
          {showSettings && (
            <div className="absolute right-0 top-12 bg-slate-800 border border-sky-700/50 rounded-xl shadow-2xl shadow-black/60 p-4 z-50 min-w-[200px]">
              <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">Settings</h3>
              <button
                onClick={() => setSoundOn(!soundOn)}
                className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-sky-800/30 transition-colors"
              >
                <span className="text-sky-200 text-sm font-medium">Sound Effects</span>
                <div className="flex items-center gap-2">
                  {soundOn ? <Volume2 size={18} className="text-green-400" /> : <VolumeX size={18} className="text-red-400" />}
                  <div className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${soundOn ? 'bg-green-600' : 'bg-slate-600'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${soundOn ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
        {gamePhase === 'difficulty' && (
          <DifficultySelect onSelect={handleDifficultySelect} />
        )}

        {gamePhase !== 'difficulty' && (
          <div className={`text-center px-6 py-3 rounded-lg font-semibold text-lg tracking-wide ${
            winner === 'player' ? 'bg-green-600/30 text-green-300 border border-green-500/40' :
            winner === 'computer' ? 'bg-red-600/30 text-red-300 border border-red-500/40' :
            'bg-sky-800/30 text-sky-200 border border-sky-600/30'
          }`}>
            {message}
          </div>
        )}

        {gamePhase === 'placement' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/60 rounded-xl border border-sky-800/30">
              <img src={opponent.image} alt={opponent.name} className="w-10 h-10 rounded-full object-cover border-2 border-sky-700/50" />
              <span className="text-sky-200 font-medium">vs {opponent.name}</span>
              <span className="text-xs text-sky-400 bg-sky-800/40 px-2 py-0.5 rounded-full">Lvl {opponent.level}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsHorizontal(!isHorizontal)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors"
              >
                <RotateCw size={16} />
                {isHorizontal ? 'Horizontal' : 'Vertical'}
              </button>
              <button
                onClick={handleRandomPlacement}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
              >
                <RefreshCw size={16} />
                Random
              </button>
              <button
                onClick={handleResetPlacement}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors"
              >
                Reset
              </button>
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              {shipsToPlace.map((ship, i) => (
                <div
                  key={ship.name}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    ship.placed ? 'bg-green-700/40 text-green-300 line-through' :
                    i === currentShipIndex ? 'bg-sky-600 text-white' :
                    'bg-slate-700 text-slate-400'
                  }`}
                >
                  {ship.name} ({ship.size})
                </div>
              ))}
            </div>

            <BoardGrid
              board={playerBoard}
              isPlayer={true}
              onCellClick={handlePlacementClick}
              onCellHover={handlePlacementHover}
              onMouseLeave={() => setHoverCells(new Set())}
              placementPreview={hoverCells}
              label="Your Fleet"
              icon={<Shield className="text-sky-400" size={20} />}
            />

            {allPlaced && (
              <button
                onClick={startBattle}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-green-900/40 hover:shadow-green-800/60"
              >
                <Play size={20} />
                Start Battle
              </button>
            )}
          </div>
        )}

        {(gamePhase === 'battle' || gamePhase === 'gameover') && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/60 rounded-xl border border-sky-800/30">
              <img src={opponent.image} alt={opponent.name} className="w-10 h-10 rounded-full object-cover border-2 border-sky-700/50" />
              <span className="text-sky-200 font-medium">vs {opponent.name}</span>
              <span className="text-xs text-sky-400 bg-sky-800/40 px-2 py-0.5 rounded-full">Lvl {opponent.level}</span>
              <div className="w-px h-6 bg-sky-700/40" />
              <span className="text-sky-300 text-sm font-medium">Shots: {playerShotCount}</span>
            </div>

            <div className="flex gap-6 text-sm font-medium">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-800/40 rounded-lg border border-sky-700/30">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sky-200">Enemy ships sunk: {computerSunkCount}/{SHIPS_CONFIG.length}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-800/40 rounded-lg border border-sky-700/30">
                <div className="w-3 h-3 rounded-full bg-sky-400" />
                <span className="text-sky-200">Your ships sunk: {playerSunkCount}/{SHIPS_CONFIG.length}</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-10">
              <BoardGrid
                board={computerVisibleBoard}
                isPlayer={false}
                onCellClick={handleAttack}
                onCellHover={handleBattleHover}
                onMouseLeave={() => setHoverCells(new Set())}
                hoverCells={hoverCells}
                label={`${opponent.name}'s Waters`}
                icon={<Crosshair className="text-red-400" size={20} />}
              />
              <BoardGrid
                board={playerBoard}
                isPlayer={true}
                label="Your Fleet"
                icon={<Shield className="text-sky-400" size={20} />}
              />
            </div>

            {gamePhase === 'gameover' && (
              <div className="flex gap-4">
                <button
                  onClick={resetGame}
                  className="flex items-center gap-2 px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg"
                >
                  <RefreshCw size={20} />
                  Play Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="py-3 text-center text-sky-700 text-xs border-t border-sky-900/40">
        Battleship &mdash; Sink the enemy fleet to win
      </footer>
    </div>
  )
}

export default App
