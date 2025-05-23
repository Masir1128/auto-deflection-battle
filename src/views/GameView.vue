<template>
  <div class="game-container">
    <!-- 添加角色设置面板 -->
    <div class="character-settings" v-if="!gameStarted">
      <h3>角色设置</h3>
      <div class="avatar-upload-container">
        <div class="avatar-upload">
          <div class="avatar-preview" :style="{ backgroundColor: playerColors[0] }">
            <img v-if="avatars.player1" :src="avatars.player1" alt="Player 1" />
          </div>
          <div class="name-input">
            <input 
              type="text" 
              v-model="playerNames.player1" 
              placeholder="输入绿色角色名称"
              maxlength="12"
            />
          </div>
          <label class="upload-button">
            上传绿色角色头像
            <input 
              type="file" 
              accept="image/*" 
              @change="handleAvatarUpload($event, 'player1')"
              style="display: none"
            />
          </label>
        </div>
        
        <div class="avatar-upload">
          <div class="avatar-preview" :style="{ backgroundColor: playerColors[1] }">
            <img v-if="avatars.player2" :src="avatars.player2" alt="Player 2" />
          </div>
          <div class="name-input">
            <input 
              type="text" 
              v-model="playerNames.player2" 
              placeholder="输入蓝色角色名称"
              maxlength="12"
            />
          </div>
          <label class="upload-button">
            上传蓝色角色头像
            <input 
              type="file" 
              accept="image/*" 
              @change="handleAvatarUpload($event, 'player2')"
              style="display: none"
            />
          </label>
        </div>
      </div>
    </div>

    <div class="game-area">
      <!-- 玩家信息栏 -->
      <div class="players-header">
        <div class="player-stats player1-stats">
          <div class="player-avatar" :style="{ backgroundColor: playerColors[0] }">
            <img v-if="avatars.player1" :src="avatars.player1" alt="Player 1" />
          </div>
          <div class="player-details">
            <div class="player-name">{{ playerNames.player1 }}</div>
            <div class="health-bar">
              <div 
                class="health-value" 
                :style="{ width: `${(players[0].hp / 5) * 100}%` }"
                :class="{ 'low-health': players[0].hp <= 2 }"
              ></div>
            </div>
            <div class="health-text">HP: {{ players[0].hp }}/5</div>
          </div>
        </div>

        <div class="player-stats player2-stats">
          <div class="player-details">
            <div class="player-name">{{ playerNames.player2 }}</div>
            <div class="health-bar">
              <div 
                class="health-value" 
                :style="{ width: `${(players[1].hp / 5) * 100}%` }"
                :class="{ 'low-health': players[1].hp <= 2 }"
              ></div>
            </div>
            <div class="health-text">HP: {{ players[1].hp }}/5</div>
          </div>
          <div class="player-avatar" :style="{ backgroundColor: playerColors[1] }">
            <img v-if="avatars.player2" :src="avatars.player2" alt="Player 2" />
          </div>
        </div>
      </div>

      <canvas ref="gameCanvas" width="600" height="400"></canvas>
      
      <!-- 游戏结束弹窗 -->
      <div class="game-result" v-if="gameEnded">
        <h2>游戏结束</h2>
        <div v-if="winner">
          <p>胜利者: {{ winner.name }}</p>
        </div>
        <div v-else>
          <p>平局!</p>
        </div>
        <button @click="restartGame">再来一局</button>
      </div>
      
      <!-- 开始游戏按钮 -->
      <div class="game-start" v-if="!gameStarted && !gameEnded">
        <h2>自动弹射对决</h2>
        <p>准备好观看激烈的对决了吗？</p>
        <button class="start-button" @click="startGame">开始游戏</button>
      </div>
    </div>

    <!-- 速度控制滑块 -->
    <div class="speed-controls">
      <div class="speed-control">
        <label :style="{ color: playerColors[0] }">绿色玩家速度：{{ playerSpeeds.player1 }}x</label>
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.1" 
          v-model="playerSpeeds.player1" 
          @input="updatePlayerSpeed('player1')"
          class="speed-slider"
        />
      </div>
      
      <div class="speed-control">
        <label :style="{ color: playerColors[1] }">蓝色玩家速度：{{ playerSpeeds.player2 }}x</label>
        <input 
          type="range" 
          min="0.5" 
          max="2.0" 
          step="0.1" 
          v-model="playerSpeeds.player2" 
          @input="updatePlayerSpeed('player2')"
          class="speed-slider"
        />
      </div>
    </div>

    <!-- 调试信息 -->
    <div class="debug-info" v-if="!gameStarted">
      <p>Tips: 请点击"开始游戏"按钮开始游戏</p>
      <p>物理引擎状态: {{ isPhysicsRunning ? '运行中' : '未运行' }}</p>
      <p>游戏物体数量: {{ gameStore.items.length }}</p>
      <p>画布状态: {{ gameCanvas ? '已加载' : '未加载' }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, toRefs } from 'vue'
import { useGameStore } from '../stores/gameStore'
import { usePhysics } from '../composables/usePhysics'

// 获取游戏状态
const gameStore = useGameStore()
const { 
  gameStarted, 
  gameEnded, 
  gameTimer, 
  players, 
  winner 
} = toRefs(gameStore)

// 游戏Canvas引用
const gameCanvas = ref(null)

// 调试状态
const isPhysicsRunning = ref(false)

// 初始化物理引擎
const { startGame: startPhysics, isRunning, updatePlayerSpeed: updatePhysicsSpeed } = usePhysics(gameCanvas)

// 玩家速度控制
const playerSpeeds = ref({
  player1: 0.6,
  player2: 0.6
})

// 游戏循环相关
let gameLoopInterval = null
let renderLoopId = null
const ctx = ref(null)

// 玩家头像颜色
const playerColors = ['#4CAF50', '#2196F3'] // 绿色和蓝色

// 道具加载状态
const gearLoaded = ref(false)
const heartLoaded = ref(false)

// 齿轮旋转角度
const gearRotation = ref(0)
// 齿轮旋转速度
const gearRotationSpeed = 0.05

// 血迹特效状态
const bloodSplatterEffects = ref([])

// 碰撞特效状态
const collisionEffects = ref([])

// 伤害特效状态
const damageEffects = ref([])

// 添加头像状态
const avatars = ref({
  player1: null,
  player2: null
})

// 添加角色名称状态
const playerNames = ref({
  player1: '绿色角色',
  player2: '蓝色角色'
})

// 监听名称变化并更新游戏状态
watch(playerNames, (newNames) => {
  gameStore.players[0].name = newNames.player1 || '绿色角色'
  gameStore.players[1].name = newNames.player2 || '蓝色角色'
}, { deep: true })

// 更新玩家速度
function updatePlayerSpeed(playerId) {
  const speed = parseFloat(playerSpeeds.value[playerId])
  // 更新游戏状态中的速度系数
  gameStore.setPlayerSpeed(playerId, speed)
  // 应用到物理引擎
  updatePhysicsSpeed(playerId, speed)
}

// 加载图像（现在只用颜色代替玩家头像）
function loadImages() {
  console.log('开始加载图像')
}

// 开始游戏
function startGame() {
  // 更新玩家名称
  gameStore.players[0].name = playerNames.value.player1 || '绿色角色'
  gameStore.players[1].name = playerNames.value.player2 || '蓝色角色'
  
  // 原有的开始游戏逻辑
  console.log('开始游戏')
  startPhysics()
  startGameLoop()
  startRenderLoop()
  isPhysicsRunning.value = isRunning.value
  
  // 应用玩家速度设置
  updatePlayerSpeed('player1')
  updatePlayerSpeed('player2')
}

// 重新开始游戏
function restartGame() {
  gameStore.resetGame()
  startGame()
}

// 游戏主循环
function startGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval)
  }
  
  gameLoopInterval = window.setInterval(() => {
    if (gameStore.gameStarted && !gameStore.gameEnded) {
      // 更新游戏计时器
      gameStore.gameTimer--
      
      // 检查游戏是否结束
      if (gameStore.gameTimer <= 0) {
        gameStore.endGame()
        stopGameLoop()
      }
    }
  }, 1000)
}

// 停止游戏循环
function stopGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval)
    gameLoopInterval = null
  }
  
  if (renderLoopId) {
    cancelAnimationFrame(renderLoopId)
    renderLoopId = null
  }
}

// 绘制带锯齿的齿轮
function drawGear(x, y, radius, teethCount, ctx, rotation = 0, playerGear = false, active = false) {
  const innerRadius = radius * 0.7
  const toothDepth = radius * 0.3
  
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  
  // 如果是玩家的齿轮轮廓，使用半透明效果
  if (radius > 35) {
    // 活跃状态有更强的发光效果
    const alpha = active ? 0.8 : 0.6
    ctx.globalAlpha = alpha
    
    // 绘制发光效果
    const gradient = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius + toothDepth)
    
    if (active) {
      // 活跃时使用更亮的颜色
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)')
      gradient.addColorStop(0.7, 'rgba(220, 220, 220, 0.5)')
      gradient.addColorStop(1, 'rgba(200, 200, 200, 0.2)')
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
    } else {
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)')
      gradient.addColorStop(0.7, 'rgba(200, 200, 200, 0.3)')
      gradient.addColorStop(1, 'rgba(180, 180, 180, 0.1)')
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
    }
    
    ctx.fillStyle = gradient
  } else {
    // 普通齿轮颜色
    ctx.fillStyle = '#DDDDDD'
    ctx.strokeStyle = '#666666'
    ctx.lineWidth = 1
  }
  
  ctx.beginPath()
  
  for (let i = 0; i < teethCount; i++) {
    const angle = (Math.PI * 2 / teethCount) * i
    const nextAngle = (Math.PI * 2 / teethCount) * (i + 0.5)
    const endAngle = (Math.PI * 2 / teethCount) * (i + 1)
    
    // 内圆到齿轮齿的外侧
    ctx.lineTo(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    )
    
    // 齿轮齿的顶部
    ctx.lineTo(
      Math.cos(nextAngle) * (radius + toothDepth),
      Math.sin(nextAngle) * (radius + toothDepth)
    )
    
    // 齿轮齿的另一侧回到内圆
    ctx.lineTo(
      Math.cos(endAngle) * radius,
      Math.sin(endAngle) * radius
    )
  }
  
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  
  // 如果是玩家的齿轮轮廓，不绘制内部
  if (radius > 35) {
    // 如果处于活跃状态，添加闪光点
    if (active) {
      // 在齿轮齿上添加闪光点
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      for (let i = 0; i < teethCount; i += 2) {
        const angle = (Math.PI * 2 / teethCount) * i + rotation / 2
        const x = Math.cos(angle) * (radius + toothDepth * 0.5)
        const y = Math.sin(angle) * (radius + toothDepth * 0.5)
        
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    
    ctx.restore()
    return
  }
  
  // 绘制内圆
  ctx.beginPath()
  ctx.arc(0, 0, innerRadius, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.stroke()
  
  // 绘制中心点
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2)
  ctx.fillStyle = playerGear ? '#333333' : '#888888'
  ctx.fill()
  
  // 如果是玩家齿轮，绘制简单的图案
  if (playerGear) {
    // 十字线图案
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1
    
    ctx.beginPath()
    ctx.moveTo(-radius * 0.15, 0)
    ctx.lineTo(radius * 0.15, 0)
    ctx.stroke()
    
    ctx.beginPath()
    ctx.moveTo(0, -radius * 0.15)
    ctx.lineTo(0, radius * 0.15)
    ctx.stroke()
  }
  
  ctx.restore()
}

// 添加血迹特效
function addBloodSplatter(x, y, angle, speed) {
  const effect = {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 2 + Math.random() * 2,
    life: 1.0,
    createdAt: Date.now()
  }
  bloodSplatterEffects.value.push(effect)
}

// 绘制邪恶笑脸
function drawEvilSmile(ctx, x, y, radius) {
  ctx.save()
  ctx.translate(x, y)
  
  // 眼睛
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(-radius * 0.3, -radius * 0.2, radius * 0.1, 0, Math.PI * 2)
  ctx.arc(radius * 0.3, -radius * 0.2, radius * 0.1, 0, Math.PI * 2)
  ctx.fill()
  
  // 邪恶的笑容
  ctx.beginPath()
  ctx.arc(0, radius * 0.1, radius * 0.4, 0, Math.PI)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  ctx.stroke()
  
  // 尖牙
  ctx.beginPath()
  ctx.moveTo(-radius * 0.2, radius * 0.1)
  ctx.lineTo(-radius * 0.1, radius * 0.3)
  ctx.lineTo(0, radius * 0.1)
  ctx.moveTo(radius * 0.2, radius * 0.1)
  ctx.lineTo(radius * 0.1, radius * 0.3)
  ctx.lineTo(0, radius * 0.1)
  ctx.fillStyle = '#000'
  ctx.fill()
  
  ctx.restore()
}

// 添加碰撞特效
function addCollisionEffect(x, y) {
  const effect = {
    x,
    y,
    radius: 1,
    opacity: 1,
    createdAt: Date.now()
  }
  collisionEffects.value.push(effect)
}

// 添加伤害特效
function addDamageEffect(x, y, direction) {
  // 创建多个切割线和火花效果
  const effect = {
    x,
    y,
    lines: Array.from({ length: 5 }, (_, i) => ({
      // 在扇形范围内创建切割线
      angle: direction + (Math.random() * 0.8 - 0.4), // 基础方向±0.4弧度
      length: 20 + Math.random() * 10,
      life: 1.0,
      width: 2 + Math.random() * 1
    })),
    sparks: Array.from({ length: 8 }, () => ({
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      size: 1 + Math.random() * 2,
      life: 1.0
    })),
    createdAt: Date.now()
  }
  damageEffects.value.push(effect)
}

// 渲染循环
function startRenderLoop() {
  if (!ctx.value || !gameCanvas.value) return
  
  console.log('开始渲染循环')
  
  // 齿轮特效状态
  let gearEffects = {
    player1: { active: false, time: 0, maxTime: 30 },
    player2: { active: false, time: 0, maxTime: 30 },
  }
  
  // 上一帧的齿轮状态
  let prevGearStates = {
    player1: false,
    player2: false
  }
  
  const render = () => {
    if (!ctx.value || !gameCanvas.value) return
    
    // 清空画布
    ctx.value.clearRect(0, 0, gameCanvas.value.width, gameCanvas.value.height)
    
    // 绘制背景
    ctx.value.fillStyle = '#222'
    ctx.value.fillRect(0, 0, gameCanvas.value.width, gameCanvas.value.height)
    
    // 更新齿轮旋转角度
    gearRotation.value += gearRotationSpeed
    
    // 检查玩家是否刚获得齿轮，触发特效
    gameStore.players.forEach((player, index) => {
      const playerId = `player${index + 1}`
      if (player.hasGear && !prevGearStates[playerId]) {
        // 玩家刚获得齿轮
        gearEffects[playerId].active = true
        gearEffects[playerId].time = 0
      }
      prevGearStates[playerId] = player.hasGear
      
      // 更新特效计时
      if (gearEffects[playerId].active) {
        gearEffects[playerId].time++
        if (gearEffects[playerId].time >= gearEffects[playerId].maxTime) {
          gearEffects[playerId].active = false
        }
      }
    })
    
    // 检查齿轮效果
    gameStore.checkGearEffects()
    
    // 绘制玩家
    gameStore.players.forEach((player, index) => {
      const { position } = player
      const playerId = `player${index + 1}`
      
      if (ctx.value) {
        // 如果玩家持有齿轮，先绘制头像周围的齿轮轮廓
        if (player.hasGear) {
          // 计算特效缩放
          let effectScale = 1
          if (gearEffects[playerId].active) {
            // 特效动画：从小变大再恢复正常
            const progress = gearEffects[playerId].time / gearEffects[playerId].maxTime
            if (progress < 0.5) {
              effectScale = 0.5 + progress
            } else {
              effectScale = 1
            }
          }
          
          // 绘制一个大的旋转齿轮作为轮廓
          const rotationSpeed = gearEffects[playerId].active ? -gearRotation.value : -gearRotation.value * 0.5
          drawGear(
            position.x, 
            position.y, 
            40 * effectScale, 
            16, 
            ctx.value, 
            rotationSpeed, 
            false,
            gearEffects[playerId].active
          )
          
          // 如果特效活跃，绘制额外的光晕
          if (gearEffects[playerId].active) {
            const progress = gearEffects[playerId].time / gearEffects[playerId].maxTime
            const alpha = 1 - progress
            
            ctx.value.save()
            ctx.value.globalAlpha = alpha * 0.7
            ctx.value.fillStyle = 'white'
            ctx.value.beginPath()
            ctx.value.arc(position.x, position.y, 45 * effectScale, 0, Math.PI * 2)
            ctx.value.fill()
            ctx.value.restore()
          }
        }
        
        // 绘制玩家头像
        ctx.value.save()
        ctx.value.beginPath()
        ctx.value.arc(position.x, position.y, 30, 0, Math.PI * 2)
        ctx.value.clip()
        
        if (avatars.value[playerId]) {
          // 如果有自定义头像，绘制头像
          const avatar = new Image()
          avatar.src = avatars.value[playerId]
          ctx.value.drawImage(avatar, position.x - 30, position.y - 30, 60, 60)
        } else {
          // 否则绘制默认颜色
          ctx.value.fillStyle = playerColors[index]
          ctx.value.fill()
        }
        
        ctx.value.restore()
        
        // 如果玩家有齿轮效果，绘制邪恶笑脸
        if (player.hasGear) {
          drawEvilSmile(ctx.value, position.x, position.y, 30)
        }
        
        // 玩家名称
        ctx.value.fillStyle = '#FFF'
        ctx.value.font = '12px Arial'
        ctx.value.textAlign = 'center'
        ctx.value.fillText(player.name, position.x, position.y - 40)
      }
    })
    
    // 绘制游戏道具
    if (ctx.value) {
      gameStore.items.forEach(item => {
        const { position, type } = item
        
        if (type === 'gear') {
          // 使用新的齿轮绘制函数
          drawGear(position.x, position.y, 15, 12, ctx.value, gearRotation.value)
        } else if (type === 'heart') {
          // 绘制红色爱心（用圆圈代替）
          ctx.value.fillStyle = '#F44336' // 红色
          ctx.value.beginPath()
          ctx.value.arc(position.x, position.y, 15, 0, Math.PI * 2)
          ctx.value.fill()
          
          // 绘制内部花纹，使其看起来更像爱心
          ctx.value.fillStyle = '#FFFFFF'
          ctx.value.font = '15px Arial'
          ctx.value.textAlign = 'center'
          ctx.value.textBaseline = 'middle'
          ctx.value.fillText('❤', position.x, position.y)
        }
      })
    }
    
    // 绘制血迹特效
    if (ctx.value) {
      const now = Date.now()
      bloodSplatterEffects.value = bloodSplatterEffects.value.filter(effect => {
        const age = (now - effect.createdAt) / 1000 // 转换为秒
        if (age >= 0.5) return false // 血迹特效持续0.5秒
        
        // 更新位置和生命值
        effect.x += effect.vx
        effect.y += effect.vy
        effect.life = 1 - (age / 0.5)
        
        // 绘制血迹
        ctx.value.beginPath()
        ctx.value.fillStyle = `rgba(255, 0, 0, ${effect.life * 0.8})`
        ctx.value.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2)
        ctx.value.fill()
        
        // 添加拖尾效果
        ctx.value.beginPath()
        ctx.value.strokeStyle = `rgba(200, 0, 0, ${effect.life * 0.4})`
        ctx.value.lineWidth = effect.size / 2
        ctx.value.moveTo(effect.x - effect.vx * 3, effect.y - effect.vy * 3)
        ctx.value.lineTo(effect.x, effect.y)
        ctx.value.stroke()
        
        return true
      })
    }
    
    // 绘制碰撞特效
    if (ctx.value) {
      const now = Date.now()
      collisionEffects.value = collisionEffects.value.filter(effect => {
        const age = (now - effect.createdAt) / 1000 // 转换为秒
        if (age >= 0.3) return false // 特效持续0.3秒
        
        // 计算特效大小和透明度
        effect.radius = Math.min(20, effect.radius + 1)
        effect.opacity = 1 - (age / 0.3)
        
        // 绘制发光圆圈
        const gradient = ctx.value.createRadialGradient(
          effect.x, effect.y, 0,
          effect.x, effect.y, effect.radius
        )
        gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.opacity})`)
        gradient.addColorStop(0.5, `rgba(255, 255, 200, ${effect.opacity * 0.5})`)
        gradient.addColorStop(1, `rgba(255, 255, 150, 0)`)
        
        ctx.value.fillStyle = gradient
        ctx.value.beginPath()
        ctx.value.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2)
        ctx.value.fill()
        
        return true
      })
    }
    
    // 绘制伤害特效
    if (ctx.value) {
      const now = Date.now()
      damageEffects.value = damageEffects.value.filter(effect => {
        const age = (now - effect.createdAt) / 1000 // 转换为秒
        if (age >= 0.4) return false // 特效持续0.4秒
        
        const progress = age / 0.4
        
        // 绘制切割线
        effect.lines.forEach(line => {
          const lineProgress = Math.max(0, 1 - progress * 2) // 线条先显示后消失
          if (lineProgress > 0) {
            ctx.value.beginPath()
            ctx.value.strokeStyle = `rgba(255, 50, 50, ${lineProgress})`
            ctx.value.lineWidth = line.width
            
            // 从中心点开始画线
            const startX = effect.x
            const startY = effect.y
            const endX = startX + Math.cos(line.angle) * line.length
            const endY = startY + Math.sin(line.angle) * line.length
            
            ctx.value.moveTo(startX, startY)
            ctx.value.lineTo(endX, endY)
            ctx.value.stroke()
            
            // 在线条末端添加小光点
            ctx.value.fillStyle = `rgba(255, 200, 200, ${lineProgress})`
            ctx.value.beginPath()
            ctx.value.arc(endX, endY, line.width, 0, Math.PI * 2)
            ctx.value.fill()
          }
        })
        
        // 绘制火花
        effect.sparks.forEach(spark => {
          spark.x += spark.vx
          spark.y += spark.vy
          spark.life = Math.max(0, 1 - progress * 1.5) // 火花比线条持续时间短
          
          if (spark.life > 0) {
            // 绘制火花粒子
            ctx.value.fillStyle = `rgba(255, 200, 50, ${spark.life})`
            ctx.value.beginPath()
            ctx.value.arc(
              effect.x + spark.x,
              effect.y + spark.y,
              spark.size * spark.life,
              0,
              Math.PI * 2
            )
            ctx.value.fill()
          }
        })
        
        return true
      })
    }
    
    // 检查玩家碰撞
    const players = gameStore.players
    if (players.length >= 2) {
      const dx = players[0].position.x - players[1].position.x
      const dy = players[0].position.y - players[1].position.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // 如果玩家接触（考虑玩家半径60）
      if (distance <= 60) {
        // 计算碰撞角度
        const collisionAngle = Math.atan2(dy, dx)
        
        // 检查是否有玩家带有齿轮并造成伤害
        if (players[0].hasGear) {
          // 在被攻击玩家位置创建伤害特效
          addDamageEffect(
            players[1].position.x,
            players[1].position.y,
            collisionAngle + Math.PI // 反方向
          )
        } else if (players[1].hasGear) {
          // 在被攻击玩家位置创建伤害特效
          addDamageEffect(
            players[0].position.x,
            players[0].position.y,
            collisionAngle
          )
        } else {
          // 普通碰撞显示闪光特效
          addCollisionEffect(
            (players[0].position.x + players[1].position.x) / 2,
            (players[0].position.y + players[1].position.y) / 2
          )
        }
      }
    }
    
    // 继续渲染循环
    if (gameStore.gameStarted && !gameStore.gameEnded) {
      renderLoopId = requestAnimationFrame(render)
    }
  }
  
  renderLoopId = requestAnimationFrame(render)
}

// 格式化时间显示
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 组件挂载时
onMounted(() => {
  console.log('组件挂载')
  if (gameCanvas.value) {
    console.log('获取Canvas上下文')
    ctx.value = gameCanvas.value.getContext('2d')
    loadImages()
    
    // 默认背景绘制
    if (ctx.value) {
      ctx.value.fillStyle = '#333'
      ctx.value.fillRect(0, 0, gameCanvas.value.width, gameCanvas.value.height)
      
      ctx.value.fillStyle = '#FFF'
      ctx.value.font = '24px Arial'
      ctx.value.textAlign = 'center'
      ctx.value.fillText('点击"开始游戏"按钮开始', gameCanvas.value.width / 2, gameCanvas.value.height / 2)
      
      // 绘制说明
      ctx.value.font = '16px Arial'
      ctx.value.fillText('绿色和蓝色 = 玩家，白色 = 齿轮，红色 = 爱心', gameCanvas.value.width / 2, gameCanvas.value.height / 2 + 40)
      
      // 绘制示例齿轮
      drawGear(gameCanvas.value.width / 2, gameCanvas.value.height / 2 + 80, 20, 12, ctx.value, 0)
    }
  }
})

// 组件卸载时
onUnmounted(() => {
  stopGameLoop()
})

// 监听游戏状态变化
watch(() => gameStore.gameEnded, (newValue) => {
  if (newValue) {
    stopGameLoop()
  }
})

// 在玩家碰撞处理中添加特效
function onPlayerCollision(posA, posB, playerA, playerB) {
  // 计算碰撞点（两个玩家的中点）
  const collisionX = (posA.x + posB.x) / 2
  const collisionY = (posA.y + posB.y) / 2

  // 如果任一玩家带有齿轮，显示血迹特效
  if (playerA.hasGear || playerB.hasGear) {
    // 创建多个血丝粒子
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i / 8) + (Math.random() * 0.5 - 0.25)
      const speed = 2 + Math.random() * 2
      addBloodSplatter(collisionX, collisionY, angle, speed)
    }
  } else {
    // 普通碰撞显示闪光特效
    addCollisionEffect(collisionX, collisionY)
  }
}

// 处理头像上传
function handleAvatarUpload(event, playerId) {
  const file = event.target.files[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    alert('请上传图片文件')
    return
  }
  
  // 创建 FileReader 读取图片
  const reader = new FileReader()
  reader.onload = (e) => {
    // 创建图片对象以获取尺寸
    const img = new Image()
    img.onload = () => {
      // 创建 canvas 进行圆形裁剪
      const canvas = document.createElement('canvas')
      const size = 120 // 设置统一的大小
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      
      // 绘制圆形裁剪区域
      ctx.beginPath()
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
      ctx.clip()
      
      // 计算缩放和位置以保持图片比例并居中
      const scale = Math.max(size / img.width, size / img.height)
      const x = (size - img.width * scale) / 2
      const y = (size - img.height * scale) / 2
      
      // 绘制图片
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
      
      // 将处理后的图片保存到状态
      avatars.value[playerId] = canvas.toDataURL()
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.game-container {
  display: flex;
  gap: 20px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  align-items: flex-start;
}

.game-area {
  position: relative;
  flex-grow: 1;
}

.players-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
}

.player-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
}

.player1-stats {
  padding-right: 20px;
}

.player2-stats {
  padding-left: 20px;
  flex-direction: row-reverse;
}

.player-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.player-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-grow: 1;
}

.player2-stats .player-details {
  align-items: flex-end;
}

.player-name {
  color: white;
  font-size: 14px;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.health-bar {
  width: 150px;
  height: 10px;
  background-color: #444;
  border-radius: 5px;
  overflow: hidden;
}

.health-value {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}

.health-value.low-health {
  background-color: #f44336;
}

.health-text {
  color: white;
  font-size: 12px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.speed-controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  min-width: 250px;
}

.speed-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.speed-slider {
  width: 100%;
  height: 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  -webkit-appearance: none;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
}

.speed-control label {
  color: white;
  font-size: 14px;
  text-align: center;
}

.debug-info {
  margin-top: 20px;
  padding: 10px;
  border: 1px solid #666;
  border-radius: 5px;
  background-color: #333;
  color: #FFF;
  font-family: monospace;
  width: 100%;
  max-width: 600px;
}
</style> 