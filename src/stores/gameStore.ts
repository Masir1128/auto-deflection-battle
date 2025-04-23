import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 玩家接口
interface Player {
  id: string
  name: string
  hp: number
  hasGear: boolean
  position: { x: number, y: number }
  speedFactor: number // 玩家速度系数
}

// 道具接口
interface Item {
  id: string
  type: 'gear' | 'heart'
  position: { x: number, y: number }
  velocity?: { x: number, y: number }
}

export const useGameStore = defineStore('game', () => {
  // 状态
  const gameStarted = ref(false)
  const gameEnded = ref(false)
  const gameTimer = ref(90) // 游戏时长，秒
  const players = ref<Player[]>([
    {
      id: 'player1',
      name: 'SuperIdol',
      hp: 10,
      hasGear: false,
      position: { x: 150, y: 250 },
      speedFactor: 1.0 // 默认速度系数
    },
    {
      id: 'player2',
      name: 'IShowSpeed',
      hp: 10,
      hasGear: false,
      position: { x: 450, y: 250 },
      speedFactor: 1.0 // 默认速度系数
    }
  ])
  const items = ref<Item[]>([])
  
  // 计算属性
  const winner = computed(() => {
    if (!gameEnded.value) return null
    
    const player1 = players.value[0]
    const player2 = players.value[1]
    
    if (player1.hp <= 0) return player2
    if (player2.hp <= 0) return player1
    if (player1.hp > player2.hp) return player1
    if (player2.hp > player1.hp) return player2
    
    return null // 平局
  })
  
  // 方法
  function startGame() {
    resetGame()
    gameStarted.value = true
    // 开始生成齿轮和爱心的逻辑会在游戏引擎中处理
  }
  
  function endGame() {
    gameEnded.value = true
  }
  
  function resetGame() {
    gameStarted.value = false
    gameEnded.value = false
    gameTimer.value = 90
    
    players.value.forEach(player => {
      player.hp = 10
      player.hasGear = false
      // 保留玩家的速度系数，不重置
    })
    
    items.value = []
  }
  
  function damagePlayer(playerId: string) {
    const player = players.value.find(p => p.id === playerId)
    if (player) {
      player.hp = Math.max(0, player.hp - 1)
      if (player.hp <= 0) {
        endGame()
      }
    }
  }
  
  function healPlayer(playerId: string) {
    const player = players.value.find(p => p.id === playerId)
    if (player && player.hp < 10) {
      player.hp += 1
    }
  }
  
  function setPlayerSpeed(playerId: string, speedFactor: number) {
    const player = players.value.find(p => p.id === playerId)
    if (player) {
      player.speedFactor = speedFactor
    }
  }
  
  function addItem(type: 'gear' | 'heart', position: { x: number, y: number }, velocity?: { x: number, y: number }) {
    const id = `${type}_${Date.now()}`
    items.value.push({ id, type, position, velocity })
    return id
  }
  
  function removeItem(itemId: string) {
    const index = items.value.findIndex(item => item.id === itemId)
    if (index !== -1) {
      items.value.splice(index, 1)
    }
  }
  
  function getItemById(itemId: string) {
    return items.value.find(item => item.id === itemId)
  }
  
  return {
    // 状态
    gameStarted,
    gameEnded,
    gameTimer,
    players,
    items,
    
    // 计算属性
    winner,
    
    // 方法
    startGame,
    endGame,
    resetGame,
    damagePlayer,
    healPlayer,
    setPlayerSpeed,
    addItem,
    removeItem,
    getItemById
  }
}) 