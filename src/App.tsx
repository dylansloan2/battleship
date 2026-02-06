import { useState, useCallback } from 'react'
import './App.css'
import { Anchor, RotateCw, Play, RefreshCw, Crosshair, Shield } from 'lucide-react'

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

type GamePhase = 'placement' | 'battle' | 'gameover'

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

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

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

function App() {
  const [gamePhase, setGamePhase] = useState<GamePhase>('placement')
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

  const [aiHits, setAiHits] = useState<Coordinate[]>([])
  const [aiQueue, setAiQueue] = useState<Coordinate[]>([])

  const currentShip = shipsToPlace[currentShipIndex]

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
    setMessage('Your turn! Click on the enemy board to fire.')
    setPlayerTurn(true)
  }, [])

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

  const computerTurn = useCallback(() => {
    setPlayerTurn(false)
    setMessage('Enemy is firing...')

    setTimeout(() => {
      let target: Coordinate | null = null
      const queue = [...aiQueue]
      const hits = [...aiHits]

      while (queue.length > 0 && !target) {
        const candidate = queue.shift()!
        if (playerBoard[candidate.row][candidate.col] === EMPTY || playerBoard[candidate.row][candidate.col] === SHIP) {
          target = candidate
        }
      }

      if (!target) {
        const available: Coordinate[] = []
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            if (playerBoard[r][c] === EMPTY || playerBoard[r][c] === SHIP) {
              available.push({ row: r, col: c })
            }
          }
        }
        if (available.length > 0) {
          target = available[Math.floor(Math.random() * available.length)]
        }
      }

      if (!target) return

      const newBoard = playerBoard.map(r => [...r])
      let newHits = hits
      let newQueue = queue

      if (newBoard[target.row][target.col] === SHIP) {
        newBoard[target.row][target.col] = HIT
        newHits = [...hits, target]
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
        newQueue = [...queue, ...neighbors]

        const updatedPlayerShips = playerShips.map(s => {
          if (!s.sunk && checkSunk(s, newBoard)) {
            s.coords.forEach(c => { newBoard[c.row][c.col] = SUNK })
            newHits = newHits.filter(h => !s.coords.some(c => c.row === h.row && c.col === h.col))
            newQueue = newQueue.filter(q => {
              const cellVal = newBoard[q.row]?.[q.col]
              return cellVal !== SUNK && cellVal !== HIT && cellVal !== MISS
            })
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
          setMessage('You lost! The enemy sank all your ships.')
          return
        }
      } else {
        newBoard[target.row][target.col] = MISS
      }

      setPlayerBoard(newBoard)
      setAiHits(newHits)
      setAiQueue(newQueue)
      setPlayerTurn(true)
      setMessage('Your turn! Click on the enemy board to fire.')
    }, 600)
  }, [playerBoard, playerShips, aiHits, aiQueue])

  const handleAttack = useCallback((row: number, col: number) => {
    if (gamePhase !== 'battle' || !playerTurn) return
    if (computerVisibleBoard[row][col] !== EMPTY) return

    const newVisible = computerVisibleBoard.map(r => [...r])
    const newActual = computerBoard.map(r => [...r])

    if (computerBoard[row][col] === SHIP) {
      newVisible[row][col] = HIT
      newActual[row][col] = HIT

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
        setWinner('player')
        setGamePhase('gameover')
        setMessage('You won! All enemy ships have been sunk!')
        return
      }
      setMessage('Direct hit!')
    } else {
      newVisible[row][col] = MISS
      setComputerVisibleBoard(newVisible)
      setMessage('Miss!')
    }

    setTimeout(() => computerTurn(), 400)
  }, [gamePhase, playerTurn, computerVisibleBoard, computerBoard, computerShips, computerTurn])

  const handleBattleHover = useCallback((row: number, col: number) => {
    if (gamePhase !== 'battle' || !playerTurn) return
    if (computerVisibleBoard[row][col] !== EMPTY) return
    setHoverCells(new Set([`${row},${col}`]))
  }, [gamePhase, playerTurn, computerVisibleBoard])

  const resetGame = useCallback(() => {
    setGamePhase('placement')
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
  }, [])

  const allPlaced = shipsToPlace.every(s => s.placed)

  const playerSunkCount = playerShips.filter(s => s.sunk).length
  const computerSunkCount = computerShips.filter(s => s.sunk).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex flex-col">
      <header className="flex items-center justify-center gap-3 py-5 bg-slate-900/60 border-b border-sky-800/40">
        <Anchor className="text-sky-400" size={32} />
        <h1 className="text-3xl font-extrabold text-white tracking-widest uppercase">Battleship</h1>
        <Anchor className="text-sky-400" size={32} />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
        <div className={`text-center px-6 py-3 rounded-lg font-semibold text-lg tracking-wide ${
          winner === 'player' ? 'bg-green-600/30 text-green-300 border border-green-500/40' :
          winner === 'computer' ? 'bg-red-600/30 text-red-300 border border-red-500/40' :
          'bg-sky-800/30 text-sky-200 border border-sky-600/30'
        }`}>
          {message}
        </div>

        {gamePhase === 'placement' && (
          <div className="flex flex-col items-center gap-4">
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
                label="Enemy Waters"
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
              <button
                onClick={resetGame}
                className="flex items-center gap-2 px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg"
              >
                <RefreshCw size={20} />
                Play Again
              </button>
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
